import time
from sqlalchemy import select
from ..db import PhantomApproval, PhantomEvent, PhantomAssessment, PhantomDecision, PhantomSensor, PhantomActuator, PhantomRun


def event_view(row):
    return {"id": row.id, "event_id": row.event_id, "device_id": row.device_id,
            "kind": row.kind, "sequence": row.accepted_sequence, "observed_at": row.observed_at,
            "received_at": row.received_at, "verdict": row.verdict, "reason": row.reason,
            "source": "server_owned_simulator", "run_id": row.run_id}


def assessment_view(row):
    return {"id": row.id, "trigger_id": row.trigger_id, "state": row.state, **row.evidence,
            "run_id": row.run_id, "created_at": row.created_at, "expires_at": row.expires_at}


def decision_view(db, row, actor_id=None, session_id=None):
    grant = db.scalar(select(PhantomApproval).where(PhantomApproval.command_id == row.id,
                      PhantomApproval.household_id == row.household_id))
    return {"id": row.id, "actor_id": row.actor_id, "target": row.target, "command": row.command,
            "assessment_id": row.assessment_id, "decision": row.decision, "reason": row.reason,
            "policy_revision": row.policy_revision, "created_at": row.created_at, "executed_at": row.executed_at,
            "latency_ms": row.latency_ms, "run_id": row.run_id, "execution_mode": "simulation",
            "approval": {"id": grant.id, "expires_at": grant.expires_at, "consumed_at": grant.consumed_at,
                "outcome": grant.outcome, "approver_id": grant.approver_id,
                "latency_ms": round((grant.consumed_at-row.created_at)*1000, 3) if grant.consumed_at else None,
                "can_confirm": grant.requester_id == actor_id and grant.session_id == session_id
                    and not grant.consumed_at and grant.expires_at > time.time(),
                "label": "Owner/admin approval with a login within 10 minutes"} if grant else None}


def recent(db, model, home_id, limit=50, offset=0):
    timestamp = model.received_at if model is PhantomEvent else model.created_at
    return list(db.scalars(select(model).where(model.household_id == home_id).order_by(timestamp.desc(), model.id).limit(limit).offset(offset)))


def overview(db, home, config, actor, session):
    cutoff = time.time() - (config.retention_days if config else 7)*86400
    return {"household_id": home.id, "server_time": time.time(), "revision": config.revision if config else 1,
        "initialized": config is not None,
        "capabilities": {"execution_mode": "simulation", "physical_protection": False,
                         "external_device_authentication": False, "owner_approval": True, "raw_recordings": False},
        "privacy": {"retention_days": config.retention_days if config else 7, "metadata_only": True},
        "window_seconds": config.window_seconds if config else 10,
        "rules": config.rules if config else {"hallway_light": True, "entry_lock": True},
        "sensors": [{"id": s.id, "kind": s.kind, "location": s.location, "online": s.online,
                     "last_sequence": s.last_sequence} for s in db.scalars(select(PhantomSensor).where(PhantomSensor.household_id == home.id))],
        "actuators": [{"id": a.id, "state": a.state, "executions": a.executions} for a in db.scalars(select(PhantomActuator).where(PhantomActuator.household_id == home.id))],
        "events": [event_view(e) for e in recent(db, PhantomEvent, home.id) if e.received_at >= cutoff],
        "assessments": [assessment_view(a) for a in recent(db, PhantomAssessment, home.id) if a.created_at >= cutoff],
        "decisions": [decision_view(db, d, actor.id, session.id) for d in recent(db, PhantomDecision, home.id)],
        "runs": [{"id": r.id, "scenario": r.scenario, "created_at": r.created_at, **r.result} for r in recent(db, PhantomRun, home.id, 10)]}
