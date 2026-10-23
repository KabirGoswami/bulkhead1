"""Known server-owned fixtures and a separate intentionally vulnerable sandbox.

The sandbox only writes the JSON result on its run. It cannot reach the virtual
actuator table, the existing simulator, or any gateway/physical adapter.
"""
import math
import time
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select
from ..db import PhantomRun, PhantomSensor, PhantomActuator, PhantomDecision
from .schemas import SensorEvent, CommandInput
from .ingress import ingest
from .verifier import assess
from .commands import propose, reset_fixture


def run_demo(db, home, config, actor, session, body):
    prior = db.scalar(select(PhantomRun).where(PhantomRun.household_id == home.id, PhantomRun.id == str(body.command_key)))
    if prior:
        if prior.scenario != body.scenario:
            raise HTTPException(409, "Demo key belongs to a different scenario")
        return prior
    run = PhantomRun(id=str(body.command_key), household_id=home.id, scenario=body.scenario)
    db.add(run); db.flush()
    reset_fixture(db, home, config, actor)
    for sensor in db.scalars(select(PhantomSensor).where(PhantomSensor.household_id == home.id)):
        sensor.online = True
    now = time.time()
    t = now - 2
    sandbox = {"hallway_light": "off", "entry_lock": "locked"}
    sandbox_decisions, decisions, attempts = [], [], []

    def report(device, kind, observed=t):
        sensor = db.get(PhantomSensor, (home.id, device))
        message = SensorEvent(event_id=uuid4(), household_id=home.id, device_id=device, kind=kind,
                              observed_at=observed, sequence=sensor.last_sequence+1 if sensor else 1)
        row = ingest(db, home, message, run_id=run.id, now=now)
        attempts.append(row)
        return message, row

    def action(target, command, evidence=None):
        row = propose(db, home, config, actor, session, CommandInput(command_key=uuid4(),
            target=target, command=command, assessment_id=evidence.id if evidence else None), run_id=run.id)
        decisions.append(row)
        # Intentionally naive comparison: trust the same reported event/command
        # without checking source, freshness, corroboration or owner confirmation.
        sandbox[target] = "unlocked" if command == "unlock" else "on"
        sandbox_decisions.append({"target": target, "command": command, "decision": "ALLOW",
            "trigger_id": evidence.trigger_id if evidence else None,
            "reason": "VULNERABLE_TRUST_ANY_REPORT", "command_id": row.id})

    if body.scenario == "owner_approval":
        action('entry_lock', 'unlock')
    else:
        if body.scenario == "sensor_dropout":
            report('hallway_motion', 'sensor.offline')
        message, door = report('forged_sender' if body.scenario == 'forged_sender' else 'door_contact', 'door.open')
        if body.scenario == "normal_entry":
            report('lock_sensor', 'lock.unlocked', t-0.5)
            report('hallway_motion', 'motion.detected', t+1)
        elif body.scenario == "compromised_sensor":
            report('lock_sensor', 'lock.locked')
        evidence = assess(db, home, door, config, now=now)
        if body.scenario == "replay":
            action('hallway_light', 'turn_on', evidence)
            replay = ingest(db, home, message, run_id=run.id, now=now)
            attempts.append(replay)
            evidence = assess(db, home, replay, config, now=now)
            action('entry_lock', 'unlock', evidence)
        elif body.scenario == "forged_sender":
            action('entry_lock', 'unlock', evidence)
        else:
            action('hallway_light', 'turn_on', evidence)
            if body.scenario == "compromised_sensor":
                action('entry_lock', 'unlock', evidence)
    db.flush()
    actual = {a.id: a.state for a in db.scalars(select(PhantomActuator).where(PhantomActuator.household_id == home.id))}
    latencies = sorted(d.latency_ms for d in decisions)
    benign = body.scenario in ('normal_entry', 'sensor_dropout')
    run.result = {"execution_mode": "simulation", "protected_outcome_at_run": actual,
        "sandbox_outcome": sandbox, "sandbox_decisions": sandbox_decisions,
        "decision_ids": [d.id for d in decisions], "attempt_ids": [e.id for e in attempts],
        "metrics": {"accepted_events": sum(e.verdict == 'ACCEPTED' for e in attempts),
            "rejected_events": sum(e.verdict == 'REJECTED' for e in attempts),
            "unsafe_actions_prevented": sum(d.target == 'entry_lock' and d.decision != 'ALLOW' for d in decisions)
                if body.scenario in ('compromised_sensor', 'replay', 'forged_sender') else 0,
            "false_positive_count": sum(d.target == 'hallway_light' and d.decision != 'ALLOW' for d in decisions) if benign else 0,
            "benign_fixture_count": int(benign),
            "legitimate_automations_allowed": sum(d.target == 'hallway_light' and d.executed_at is not None for d in decisions),
            "approval_requests": sum(d.decision == 'HOLD' for d in decisions),
            "decision_latency_ms": latencies,
            "p50_ms": latencies[math.ceil(len(latencies)*.5)-1],
            "p95_ms": latencies[math.ceil(len(latencies)*.95)-1]},
        "comparison_note": "The same command sequence feeds an isolated trust-any-report sandbox. PHANTOM outcomes are captured at run completion; current actuator state and later owner approval appear separately."}
    return run
