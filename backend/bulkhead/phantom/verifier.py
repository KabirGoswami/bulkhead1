"""Deterministic evidence, not a claim of physical truth or calibrated probability."""
import time
from sqlalchemy import select
from ..db import PhantomAssessment, PhantomEvent, PhantomSensor


def assess(db, home, trigger, config, *, now=None):
    now = time.time() if now is None else now
    support, conflicts, missing, offline = [], [], [], []
    state, reasons = "UNKNOWN", ["NO_CORROBORATION"]
    start = (trigger.observed_at or now) - 2
    end = (trigger.observed_at or now) + config.window_seconds
    if trigger.verdict != "ACCEPTED":
        state, reasons = "REJECTED", [trigger.reason]
    elif trigger.observed_at is None or now > end + 30:
        reasons = ["EVIDENCE_EXPIRED"]
    elif trigger.kind != "door.open":
        reasons = ["NO_ENTRY_CLAIM"]
    else:
        sensor = db.get(PhantomSensor, (home.id, trigger.device_id))
        peers = list(db.scalars(select(PhantomSensor).where(PhantomSensor.household_id == home.id,
                               PhantomSensor.location == sensor.location, PhantomSensor.id != trigger.device_id)))
        history = list(db.scalars(select(PhantomEvent).where(PhantomEvent.household_id == home.id,
                           PhantomEvent.run_id == trigger.run_id, PhantomEvent.verdict == "ACCEPTED",
                           PhantomEvent.observed_at >= start, PhantomEvent.observed_at <= min(end, now),
                           PhantomEvent.received_at <= now).order_by(PhantomEvent.observed_at)))
        for peer in peers:
            reports = [e for e in history if e.device_id == peer.id]
            if not peer.online:
                offline.append(peer.id)
            positive = [e for e in reports if e.kind in ("motion.detected", "presence.detected")
                        and e.observed_at >= trigger.observed_at]
            support.extend(e.id for e in positive)
            # This simulated fixture has an interlocked bolt: a locked report
            # simultaneous with an open contact conflicts. Older lock reports
            # are NOT contradictions: an intervening unlock may be unobserved.
            conflicts.extend(e.id for e in reports if e.kind == "lock.locked"
                             and abs(e.observed_at - trigger.observed_at) <= 0.25)
            if peer.kind in ("motion", "presence") and not positive:
                missing.append(peer.id)
        if conflicts:
            state, reasons = "INCONSISTENT", ["FIXTURE_BOLT_CONTACT_CONFLICT"]
        elif support:
            state, reasons = "VERIFIED", ["NEARBY_ENTRY_CORROBORATED"]
        else:
            reasons = ["CORRELATION_PENDING" if now < end else "NO_CORROBORATION"]
        if offline:
            reasons.append("SENSOR_OFFLINE")
        if trigger.received_at - trigger.observed_at > config.window_seconds:
            reasons.append("LATE_REPORT")
    explanation = {
        "VERIFIED": "Independent nearby metadata supports entry; it does not identify a person or prove physical truth.",
        "UNKNOWN": "Evidence is incomplete. A door may open without anyone entering; no intrusion is established.",
        "INCONSISTENT": "The fixture reports an open contact and a locked interlocked bolt at the same time. Review the disagreement; compromise is not confirmed.",
        "REJECTED": "The simulator identity or freshness check failed. This attempt cannot trigger an action.",
    }[state]
    row = PhantomAssessment(household_id=home.id, trigger_id=trigger.id, run_id=trigger.run_id,
        state=state, created_at=now, expires_at=now+120,
        evidence={"supporting_event_ids": support, "conflicting_event_ids": conflicts,
                  "missing_sensor_ids": missing, "offline_sensor_ids": offline,
                  "window_start": start, "window_end": end, "reason_codes": reasons,
                  "risk_score": {"VERIFIED": 15, "UNKNOWN": 45, "INCONSISTENT": 80, "REJECTED": 100}[state],
                  "confidence": {"VERIFIED": "corroborated", "UNKNOWN": "limited", "INCONSISTENT": "conflicting", "REJECTED": "invalid source or freshness"}[state],
                  "explanation": explanation})
    db.add(row)
    db.flush()
    return row
