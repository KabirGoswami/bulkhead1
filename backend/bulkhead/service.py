import json
import time
from pathlib import Path
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, or_, desc
from models import HomeState, Device, Account
from baseline import BaselineEngine
from simulator import HomeSimulator
from detector import DetectorEngine
from blast import calculate_exposure_score_fixed, topology_edges, get_reachable_nodes
from policy import PolicyEngine
from alert_model import Alert
from .db import (DeviceRecord, VendorAccount, PolicyRecord, Incident, Action, AuditEvent,
                 EventRecord, Job, WorkerHealth, Membership, User, uid)
from .security import audit, iso, digest
from .config import settings


def load_state(db, home):
    devices = [Device(**d.data) for d in db.scalars(select(DeviceRecord).where(DeviceRecord.household_id == home.id))]
    accounts = [Account(**a.data) for a in db.scalars(select(VendorAccount).where(VendorAccount.household_id == home.id))]
    order = {key: i for i, key in enumerate(["router", "hub", "camera_1", "lock_1", "thermostat", "speaker", "plug_1", "bulb_1", "phone", "laptop"])}
    devices.sort(key=lambda d: (order.get(d.seed_key, 100), d.name, d.id))
    accounts.sort(key=lambda a: (a.seed_key or "", a.id))
    policies = list(db.scalars(select(PolicyRecord).where(PolicyRecord.household_id == home.id, PolicyRecord.active == True,
                    or_(PolicyRecord.expires_at == None, PolicyRecord.expires_at > time.time())).order_by(PolicyRecord.revision)))
    for d in devices:
        for p in policies:
            if p.device_id == d.id:
                d.policy_peers = p.data.get("peers", [])
                d.policy_destinations = p.data.get("destinations", [])
    return HomeState(devices=devices, accounts=accounts)


def save_state(db, home, state):
    for model, nodes in ((DeviceRecord, state.devices), (VendorAccount, state.accounts)):
        for node in nodes:
            row = db.scalar(select(model).where(model.household_id == home.id, model.id == node.id))
            if row:
                data = node.model_dump(mode="json")
                data.pop("policy_peers", None)
                data.pop("policy_destinations", None)
                row.data = data


def seed_household(db, home):
    root = Path(__file__).resolve().parents[1]
    devices, accounts = json.loads((root/"seed_home.json").read_text()), json.loads((root/"accounts.json").read_text())
    mapping = {node["id"]: uid() for node in [*devices, *accounts]}
    for item in devices:
        key = item["id"]
        item.update(id=mapping[key], seed_key=key, account_ids=[mapping[n] for n in item["account_ids"]],
                    allowed_peers=[mapping[n] for n in item["allowed_peers"]])
        d = Device(**item)
        db.add(DeviceRecord(id=d.id, household_id=home.id, data=d.model_dump(mode="json")))
    for item in accounts:
        key = item["id"]
        item.update(id=mapping[key], seed_key=key, linked_device_ids=[mapping[n] for n in item["linked_device_ids"]])
        a = Account(**item)
        db.add(VendorAccount(id=a.id, household_id=home.id, data=a.model_dump(mode="json")))
    db.flush()
    # Seeded *simulation* baseline uses known benign fixtures, never attack observations.
    baseline = BaselineEngine()
    simulator = HomeSimulator(load_state(db, home))
    for _ in range(100):
        for event in simulator.generate_tick():
            baseline.process_event(event)
    home.simulation = {"scenario": None, "tick": 0, "baselines": baseline.dump()}
    db.add(Job(kind="tick", household_id=home.id, dedupe_key=f"tick:{home.id}:0"))


def emit(db, home, kind, payload):
    home.sequence += 1
    if isinstance(payload, dict) and "household_id" in payload:
        payload = {**payload, "sequence": home.sequence}
    elif isinstance(payload, dict) and "state" in payload:
        payload = {**payload, "state": {**payload["state"], "sequence": home.sequence}}
    # Household row is locked by every writer. A sequence and its mutation commit together.
    db.add(EventRecord(household_id=home.id, sequence=home.sequence, kind=kind,
                       payload=jsonable_encoder(payload)))


def action_view(a):
    return {"id": a.id, "incident_id": a.incident_id, "actor_id": a.actor_id, "node_id": a.node_id,
            "action_type": a.kind, "execution_mode": a.mode, "policy_revision": a.policy_revision,
            "state": a.state, "created_at": iso(a.created_at), "expired": bool(a.expires_at and a.expires_at <= time.time()), "expires_at": a.expires_at, "result": a.result}


def incident_view(i, state, profile):
    alert = Alert(**i.alert)
    return {"id": i.id, "status": i.status, "created_at": iso(i.created_at),
            "alert": {**i.alert, "response": PolicyEngine().determine_response(alert, state, profile)}}


def worker_status(db):
    heartbeat = db.scalar(select(WorkerHealth).order_by(desc(WorkerHealth.heartbeat)).limit(1))
    return {"healthy": bool(heartbeat and heartbeat.heartbeat > time.time()-15),
            "heartbeat": heartbeat.heartbeat if heartbeat else None,
            "error": heartbeat.error if heartbeat else None}


def snapshot(db, home):
    state = load_state(db, home)
    incidents = list(db.scalars(select(Incident).where(Incident.household_id == home.id).order_by(desc(Incident.created_at)).limit(100)))
    actions = list(db.scalars(select(Action).where(Action.household_id == home.id).order_by(desc(Action.created_at)).limit(200)))
    return {"household_id": home.id, "name": home.name, "profile": home.profile,
            "policy_revision": home.policy_revision, "sequence": home.sequence,
            **state.model_dump(mode="json"), "edges": topology_edges(state),
            "exposure_score": calculate_exposure_score_fixed(state),
            "incidents": [incident_view(i, state, home.profile) for i in incidents],
            "actions": [action_view(a) for a in actions], "worker": worker_status(db),
            "scenario": home.simulation.get("scenario"), "tick": home.simulation.get("tick", 0),
            "capabilities": {"execution_mode": "simulation", "adapter_enabled": settings().adapter_enabled,
                             "dry_run": settings().dry_run, "physical_protection": False,
                             "vendor_cloud_enforcement": False, "public_simulator": False}}


def changed(db, home, kind, actor=None, **data):
    audit(db, kind, actor=actor, household=home.id, **data)
    db.flush()
    emit(db, home, "STATE_UPDATE", snapshot(db, home))


def execute_simulation(db, home, incident, kind, actor, key, revision):
    duplicate = db.scalar(select(Action).where(Action.household_id == home.id, Action.command_key == key))
    if duplicate:
        if duplicate.incident_id != incident.id or duplicate.kind != kind or duplicate.mode != "simulation":
            raise HTTPException(409, "Command key already used for a different action")
        return duplicate
    active = db.scalar(select(Action).where(Action.household_id == home.id, Action.incident_id == incident.id,
                       Action.kind == kind, Action.mode == "simulation", Action.state.in_(["applied", "verified"])))
    if active:
        return active
    if incident.status == "resolved":
        raise HTTPException(409, "Incident is resolved")
    if revision != home.policy_revision:
        raise HTTPException(409, "Policy changed; refresh the incident before confirming")
    state = load_state(db, home)
    alert = Alert(**incident.alert)
    policy = PolicyEngine()
    response = policy.determine_response(alert, state, home.profile)
    if kind not in ("CONTAIN", "REVOKE") or response["action"] != kind:
        raise HTTPException(409, "Action is not permitted by the current alert policy")
    prior_active = db.scalar(select(Action).where(Action.household_id == home.id, Action.node_id == incident.node_id,
                             Action.mode == "simulation", Action.state.in_(["applied", "verified"])))
    if prior_active:
        raise HTTPException(409, "This node already has an active action")
    try:
        executed = policy.execute_action(alert, kind, state)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    row = Action(id=executed.id, household_id=home.id, incident_id=incident.id, actor_id=actor,
                 command_key=key, kind=kind, node_id=alert.node_id, mode="simulation", state="verified",
                 policy_revision=home.policy_revision, previous=executed.previous_state,
                 result={"verification": "Simulated access changed; no vendor API or physical device controlled"},
                 expires_at=time.time()+900 if kind == "CONTAIN" else None)
    db.add(row)
    save_state(db, home, state)
    changed(db, home, "action.verified", actor=actor, action_id=row.id, incident_id=incident.id, mode="simulation")
    return row


def restore_simulation(db, home, action, actor=None):
    if action.state == "rolled_back":
        return action
    if action.mode != "simulation" or action.state not in ("verified", "applied"):
        raise HTTPException(409, "Action cannot be undone in the simulator")
    state = load_state(db, home)
    node = next((n for n in [*state.devices, *state.accounts] if n.id == action.node_id), None)
    if not node:
        raise HTTPException(409, "Original node no longer exists")
    for field, value in action.previous.items():
        setattr(node, field, value)
    save_state(db, home, state)
    action.state = "rolled_back"
    changed(db, home, "action.rolled_back", actor=actor, action_id=action.id)
    return action


def notify_incident(db, home, incident):
    if not home.preferences.get("email_notifications", True):
        return
    from .auth import queue_mail
    members = db.scalars(select(Membership).where(Membership.household_id == home.id,
                         or_(Membership.expires_at == None, Membership.expires_at > time.time())))
    for member in members:
        user = db.get(User, member.user_id)
        if user and user.verified:
            queue_mail(db, user.email, f"Bulkhead incident in {home.name}",
                       f"{incident.alert['explanation']}\nReview: {settings().origin}/#/alerts",
                       f"incident:{incident.id}:{user.id}", home.id)


def tick(db, home):
    for action in db.scalars(select(Action).where(Action.household_id == home.id, Action.mode == "simulation",
                            Action.state.in_(["applied", "verified"]), Action.expires_at <= time.time())):
        restore_simulation(db, home, action)
    expired = list(db.scalars(select(PolicyRecord).where(PolicyRecord.household_id == home.id, PolicyRecord.active == True,
                             PolicyRecord.expires_at != None, PolicyRecord.expires_at <= time.time())))
    if expired:
        for p in expired:
            p.active = False
        home.policy_revision += 1
        changed(db, home, "policy.expired")
    state = load_state(db, home)
    simulator = HomeSimulator(state)
    simulator.current_scenario = home.simulation.get("scenario")
    simulator.tick_count = home.simulation.get("tick", 0)
    baseline = BaselineEngine()
    baseline.restore(home.simulation.get("baselines", {}))
    detector = DetectorEngine(baseline, {d.id for d in state.devices})
    traffic = simulator.generate_tick()
    alerts = []
    for event in [*traffic, *simulator.blocked]:
        # Detect attempts before learning. Suspicious auth is never added to a trusted baseline.
        alert = detector.analyze_event(event)
        if not alert:
            from events import AuthEvent
            if not isinstance(event, AuthEvent) or (event.geo == "Home" and event.result == "success"):
                baseline.process_event(event)
            continue
        fingerprint = digest(f"{alert.node_id}:{','.join(sorted(alert.reason_codes))}")
        existing = db.scalar(select(Incident).where(Incident.household_id == home.id,
                             Incident.fingerprint == fingerprint, Incident.status != "resolved"))
        if existing:
            continue
        incident = Incident(household_id=home.id, node_id=alert.node_id, fingerprint=fingerprint,
                            alert=alert.model_dump(mode="json"))
        db.add(incident)
        db.flush()
        response = PolicyEngine().determine_response(alert, state, home.profile)
        alerts.append({**alert.model_dump(mode="json"), "incident_id": incident.id, "response": response})
        audit(db, "incident.detected", household=home.id, incident_id=incident.id, explanation=alert.explanation)
        notify_incident(db, home, incident)
        active = db.scalar(select(Action.id).where(Action.household_id == home.id, Action.node_id == alert.node_id, Action.mode == "simulation", Action.state.in_(["applied", "verified"])))
        if response["can_auto_act"] and not active:
            execute_simulation(db, home, incident, response["action"], None, f"auto:{incident.id}", home.policy_revision)
            # Later events see containment in the same transaction.
            state = load_state(db, home)
    home.simulation = {"scenario": simulator.current_scenario, "tick": simulator.tick_count, "baselines": baseline.dump()}
    db.flush()
    emit(db, home, "SIM_TICK", {"events": [e.model_dump(mode="json") for e in traffic],
                              "blocked": [e.model_dump(mode="json") for e in simulator.blocked],
                              "alerts": alerts, "state": snapshot(db, home)})
    db.add(Job(kind="tick", household_id=home.id, dedupe_key=f"tick:{home.id}:{home.simulation['tick']}",
               available_at=time.time()+settings().tick_seconds))
