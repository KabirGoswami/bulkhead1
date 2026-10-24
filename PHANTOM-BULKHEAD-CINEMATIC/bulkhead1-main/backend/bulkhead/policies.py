import re
import time
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from profiles import PROFILES
from blast import get_reachable_nodes
from .db import DB, DeviceRecord, PolicyRecord
from .security import CurrentUser, household_access
from .service import load_state, changed

router = APIRouter(prefix="/api/v1/households/{household_id}", tags=["policies"])


class PolicyInput(BaseModel):
    device_id: str
    peers: list[str] = Field(default_factory=list, max_length=100)
    destinations: list[str] = Field(default_factory=list, max_length=100)
    expires_in: int | None = Field(default=None, ge=60, le=86400)
    policy_revision: int


def validate(db, home, body):
    if body.policy_revision != home.policy_revision:
        raise HTTPException(409, "Policy revision changed; preview again")
    state = load_state(db, home)
    ids = {d.id for d in state.devices}
    if body.device_id not in ids or not set(body.peers).issubset(ids):
        raise HTTPException(404, "Device or peer not found")
    if any(not re.fullmatch(r"\*|(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?", d) for d in body.destinations):
        raise HTTPException(422, "Destinations must be exact DNS names or wildcard domain rules")
    return state


@router.get("/policies")
def policies(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    rows = db.scalars(select(PolicyRecord).where(PolicyRecord.household_id == home.id).order_by(PolicyRecord.revision.desc()))
    return {"policy_revision": home.policy_revision, "policies": [{"id": p.id, "device_id": p.device_id, **p.data,
            "revision": p.revision, "active": p.active and (not p.expires_at or p.expires_at > time.time()), "expires_at": p.expires_at} for p in rows]}


@router.post("/policies/preview")
def preview(household_id: str, body: PolicyInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    state = validate(db, home, body)
    before = get_reachable_nodes(state, body.device_id)
    device = next(d for d in state.devices if d.id == body.device_id)
    device.policy_peers, device.policy_destinations = body.peers, body.destinations
    after = get_reachable_nodes(state, body.device_id)
    return {"policy_revision": home.policy_revision, "before": sorted(before), "after": sorted(after),
            "removed": sorted(before-after), "added": sorted(after-before), "execution_mode": "simulation",
            "note": "Shared vendor-account paths remain until account access is separately revoked."}


@router.post("/policies", status_code=201)
def create_policy(household_id: str, body: PolicyInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    validate(db, home, body)
    if not body.expires_in:
        for p in db.scalars(select(PolicyRecord).where(PolicyRecord.household_id == home.id, PolicyRecord.device_id == body.device_id, PolicyRecord.active == True)):
            p.active = False
    home.policy_revision += 1
    policy = PolicyRecord(household_id=home.id, device_id=body.device_id, revision=home.policy_revision,
                          data={"peers": sorted(set(body.peers)), "destinations": sorted(set(body.destinations))},
                          expires_at=time.time()+body.expires_in if body.expires_in else None)
    db.add(policy)
    changed(db, home, "policy.created", actor=user.id, device_id=body.device_id, revision=home.policy_revision, temporary=bool(body.expires_in))
    return {"id": policy.id, "policy_revision": home.policy_revision, "execution_mode": "simulation", "state": "applied", "expires_at": policy.expires_at}


@router.delete("/policies/{policy_id}")
def remove_policy(household_id: str, policy_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    p = db.scalar(select(PolicyRecord).where(PolicyRecord.id == policy_id, PolicyRecord.household_id == home.id))
    if not p:
        raise HTTPException(404, "Policy not found")
    p.active = False
    home.policy_revision += 1
    changed(db, home, "policy.removed", actor=user.id, policy_id=p.id)
    return {"state": "removed", "policy_revision": home.policy_revision}


class ProfileInput(BaseModel):
    profile: Literal["Admin", "Family", "Work", "Solo"]


@router.post("/profile")
def profile(household_id: str, body: ProfileInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    home.profile = body.profile
    home.policy_revision += 1
    changed(db, home, "profile.changed", actor=user.id, profile=home.profile)
    return {"profile": home.profile, "policy_revision": home.policy_revision}


@router.post("/scenarios/reset")
def reset(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    home.simulation = {**home.simulation, "scenario": None}
    changed(db, home, "simulation.reset", actor=user.id)
    return {"scenario": None, "message": "Scenario stopped. Inventory, incidents and action history are retained."}


@router.post("/scenarios/{scenario_id}")
def scenario(household_id: str, scenario_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    if scenario_id not in ("A", "B", "C"):
        raise HTTPException(400, "Unknown scenario")
    home.simulation = {**home.simulation, "scenario": scenario_id}
    changed(db, home, "simulation.started", actor=user.id, scenario=scenario_id)
    return {"scenario": scenario_id}
