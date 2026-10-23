import secrets
import time
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from .db import DB, Agent, Action, Incident, DeviceRecord, Token, uid, Household
from .security import CurrentUser, household_access, token_new, token_use, digest, audit
from .config import settings
from .service import changed, action_view, load_state
from policy import PolicyEngine
from alert_model import Alert

router = APIRouter(tags=["gateway agent"])


@router.post("/api/v1/households/{household_id}/integrations/gateway/enrollment")
def enrollment(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, owner=True)
    raw = token_new(db, "agent_enrollment", user.id, ttl=600, household_id=home.id)
    audit(db, "gateway.enrollment_created", actor=user.id, household=home.id)
    return {"enrollment_token": raw, "expires_in": 600}


class EnrollInput(BaseModel):
    enrollment_token: str = Field(min_length=20, max_length=512)


@router.post("/api/v1/gateway/enroll", status_code=201)
def enroll(body: EnrollInput, db: DB):
    token = token_use(db, body.enrollment_token, "agent_enrollment")
    raw = secrets.token_urlsafe(48)
    agent = Agent(household_id=token.data["household_id"], credential_hash=digest(raw))
    db.add(agent)
    db.flush()
    audit(db, "gateway.enrolled", actor=token.user_id, household=agent.household_id, agent_id=agent.id)
    return {"agent_id": agent.id, "credential": raw, "household_id": agent.household_id}


def authenticate(db, request):
    scheme, _, raw = request.headers.get("authorization", "").partition(" ")
    if scheme != "Bearer" or not raw:
        raise HTTPException(401, "Agent credential required")
    agent = db.scalar(select(Agent).where(Agent.credential_hash == digest(raw), Agent.revoked == False).with_for_update())
    if not agent:
        raise HTTPException(401, "Agent credential invalid")
    return agent


@router.post("/api/v1/gateway/heartbeat")
def heartbeat(db: DB, request: Request):
    agent = authenticate(db, request)
    agent.heartbeat = time.time()
    return {"agent_id": agent.id, "adapter_enabled": settings().adapter_enabled, "dry_run": settings().dry_run}


@router.get("/api/v1/gateway/jobs")
def jobs(db: DB, request: Request):
    agent = authenticate(db, request)
    agent.heartbeat = time.time()
    home = db.scalar(select(Household).where(Household.id == agent.household_id).with_for_update())
    rows = db.scalars(select(Action).where(Action.household_id == agent.household_id,
                      Action.mode.in_(["openwrt", "dry_run"]), Action.state.in_(["planned", "applied"])).order_by(Action.created_at).limit(10))
    result = []
    for action in rows:
        if action.result.get("agent_id") != agent.id:
            continue
        if action.state == "planned" and action.kind == "QUARANTINE":
            device = db.get(DeviceRecord, action.node_id)
            incident = db.get(Incident, action.incident_id)
            expected = action.result["mapping"]
            invalid = (not device or device.household_id != home.id or not incident or incident.status == "resolved"
                       or action.policy_revision != home.policy_revision or action.expires_at <= time.time()
                       or device.data.get("approval") != "approved" or device.data.get("trusted_ipv4") != expected["ipv4"]
                       or device.data.get("trusted_mac") != expected["mac"]
                       or (action.mode == "openwrt" and (not settings().adapter_enabled or settings().dry_run)))
            if invalid:
                action.state = "failed"
                action.result = {**action.result, "detail": "Expired or changed policy/mapping; execution cancelled"}
                changed(db, home, "gateway.cancelled", action_id=action.id, agent_id=agent.id)
                continue
        result.append({**action_view(action), "mapping": action.result["mapping"], "restore_of": action.result.get("restore_of")})
    return result



class GatewayAction(BaseModel):
    incident_id: str
    agent_id: str
    device_id: str
    command_id: str = Field(min_length=16, max_length=64)
    policy_revision: int
    confirmation: str
    expires_in: int = Field(default=900, ge=60, le=900)


@router.post("/api/v1/households/{household_id}/integrations/gateway/actions", status_code=201)
def quarantine(household_id: str, body: GatewayAction, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, owner=True)
    cfg = settings()
    if not cfg.adapter_enabled and not cfg.dry_run:
        raise HTTPException(503, "Gateway adapter is disabled")
    if body.confirmation != f"QUARANTINE {body.device_id}":
        raise HTTPException(422, "Explicit confirmation must name this device UUID")
    duplicate = db.scalar(select(Action).where(Action.household_id == home.id, Action.command_key == body.command_id))
    if duplicate:
        if duplicate.node_id != body.device_id or duplicate.incident_id != body.incident_id:
            raise HTTPException(409, "Command ID already used")
        return action_view(duplicate)
    if body.policy_revision != home.policy_revision:
        raise HTTPException(409, "Policy changed; review again")
    agent = db.scalar(select(Agent).where(Agent.id == body.agent_id, Agent.household_id == home.id, Agent.revoked == False))
    incident = db.scalar(select(Incident).where(Incident.id == body.incident_id, Incident.household_id == home.id, Incident.status != "resolved"))
    device = db.scalar(select(DeviceRecord).where(DeviceRecord.id == body.device_id, DeviceRecord.household_id == home.id))
    if not agent or not incident or not device or incident.node_id != device.id:
        raise HTTPException(404, "Agent, incident or device not found")
    response = PolicyEngine().determine_response(Alert(**incident.alert), load_state(db, home), home.profile)
    if response["action"] != "CONTAIN":
        raise HTTPException(409, "Current incident is notify only or requires vendor-account revocation")
    data = device.data
    if data.get("approval") != "approved" or not data.get("trusted_ipv4") or not data.get("trusted_mac") or data["type"] in ("router", "hub"):
        raise HTTPException(409, "An approved non-management device with a trusted mapping is required")
    active = db.scalar(select(Action).where(Action.household_id == home.id, Action.mode == "openwrt",
                       Action.state.in_(["planned", "applied", "verified"]), Action.kind == "QUARANTINE"))
    if active:
        raise HTTPException(409, "V1 allows one real device quarantine at a time")
    mode = "dry_run" if cfg.dry_run else "openwrt"
    action = Action(id=uid(), household_id=home.id, incident_id=incident.id, actor_id=user.id,
                    node_id=device.id, command_key=body.command_id, kind="QUARANTINE", mode=mode,
                    policy_revision=home.policy_revision, expires_at=time.time()+body.expires_in,
                    result={"agent_id": agent.id, "mapping": {"device_id": device.id, "ipv4": data["trusted_ipv4"], "mac": data["trusted_mac"]}})
    db.add(action)
    changed(db, home, "gateway.planned", actor=user.id, action_id=action.id, mode=mode)
    return action_view(action)


@router.post("/api/v1/households/{household_id}/integrations/gateway/actions/{action_id}/restore")
def restore(household_id: str, action_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, owner=True)
    action = db.scalar(select(Action).where(Action.household_id == home.id, Action.id == action_id, Action.mode.in_(["openwrt", "dry_run"])))
    if not action or action.kind != "QUARANTINE":
        raise HTTPException(404, "Gateway quarantine not found")
    prior = db.scalar(select(Action).where(Action.household_id == home.id, Action.command_key == f"restore:{action.id}"))
    if prior:
        return action_view(prior)
    row = Action(household_id=home.id, incident_id=action.incident_id, actor_id=user.id,
                 command_key=f"restore:{action.id}", kind="RESTORE", node_id=action.node_id, mode=action.mode,
                 policy_revision=home.policy_revision, result={**action.result, "restore_of": action.id})
    db.add(row)
    changed(db, home, "gateway.restore_planned", actor=user.id, action_id=action.id)
    return action_view(row)


class ResultInput(BaseModel):
    state: Literal["applied", "verified", "failed", "rolled_back"]
    router_state: Literal["blocked", "restored", "unchanged", "unknown"]
    packet_verified: bool = False
    detail: str = Field(max_length=500)


@router.post("/api/v1/gateway/jobs/{action_id}/results")
def results(action_id: str, body: ResultInput, db: DB, request: Request):
    agent = authenticate(db, request)
    from .db import Household
    home = db.scalar(select(Household).where(Household.id == agent.household_id).with_for_update())
    action = db.scalar(select(Action).where(Action.id == action_id, Action.household_id == agent.household_id).with_for_update())
    if not action or action.result.get("agent_id") != agent.id or action.mode not in ("dry_run", "openwrt"):
        raise HTTPException(404, "Job not found")
    if action.state in ("verified", "failed", "rolled_back"):
        expired_recovery = action.state == "verified" and body.state == "rolled_back" and action.mode == "openwrt" and action.expires_at and action.expires_at <= time.time()
        if not expired_recovery:
            return action_view(action)
        if not body.packet_verified or body.router_state != "restored":
            raise HTTPException(422, "Expired quarantine requires restoration verification")
    if body.state == "verified" and action.mode == "openwrt" and (not body.packet_verified or body.router_state != ("restored" if action.kind == "RESTORE" else "blocked")):
        raise HTTPException(422, "Packet verification is required")
    if action.mode == "dry_run" and body.router_state != "unchanged":
        raise HTTPException(422, "Dry-run must not change firewall state")
    action.state = body.state
    action.result = {**action.result, **body.model_dump()}
    if action.kind == "RESTORE" and body.state == "verified":
        original = db.get(Action, action.result["restore_of"])
        original.state = "rolled_back"
    changed(db, home, "gateway."+body.state, action_id=action.id, agent_id=agent.id, mode=action.mode)
    return action_view(action)


@router.delete("/api/v1/households/{household_id}/integrations/gateway/agents/{agent_id}")
def revoke(household_id: str, agent_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, owner=True)
    agent = db.scalar(select(Agent).where(Agent.id == agent_id, Agent.household_id == home.id))
    if not agent:
        raise HTTPException(404, "Agent not found")
    agent.revoked = True
    changed(db, home, "gateway.revoked", actor=user.id, agent_id=agent.id)
    return {"message": "Agent credential revoked. Router timeouts still restore quarantines."}
