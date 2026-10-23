"""Internal simulated bus. There is intentionally no HTTP event-injection route."""
import time
from fastapi import HTTPException
from sqlalchemy import select, update
from ..db import Household, PhantomConfig, PhantomSensor, PhantomEvent, PhantomActuator, PhantomAssessment
from ..security import household_access, audit
from .schemas import SensorEvent


def write_home(db, household_id, actor_id):
    # SQLite ignores FOR UPDATE. A no-op write obtains its database writer lock
    # before reading any guards. PostgreSQL serializes on the household row.
    db.execute(update(Household).where(Household.id == household_id).values(sequence=Household.sequence))
    db.expire_all()
    return household_access(db, household_id, actor_id, write=True)[0]


def fixture(db, home):
    config = db.get(PhantomConfig, home.id)
    if not config:
        config = PhantomConfig(household_id=home.id)
        db.add(config)
        # Separate inventory prevents PHANTOM from changing A/B/C baseline inputs.
        for name, kind in (("door_contact", "door"), ("hallway_motion", "motion"), ("lock_sensor", "lock"), ("presence_sensor", "presence")):
            db.add(PhantomSensor(household_id=home.id, id=name, kind=kind, location="entrance"))
        for name, state in (("hallway_light", "off"), ("entry_lock", "locked")):
            db.add(PhantomActuator(household_id=home.id, id=name, state=state))
        db.flush()
    return config


def ingest(db, home, event: SensorEvent, *, run_id=None, now=None):
    """Caller holds the household write lock; only server code supplies events.

    Accepted IDs and counters are durable even when evidence metadata is purged.
    A rejected attempt is persisted, but never advances a counter or actuator.
    """
    now = time.time() if now is None else now
    if str(event.household_id) != home.id:
        raise HTTPException(404, "Household mismatch")
    sensor = db.get(PhantomSensor, (home.id, event.device_id))
    duplicate = db.scalar(select(PhantomEvent.id).where(PhantomEvent.household_id == home.id,
                          PhantomEvent.accepted_id == str(event.event_id)))
    reason = None
    if not sensor:
        reason = "UNREGISTERED_SIMULATED_SOURCE"
    elif duplicate:
        reason = "DUPLICATE_EVENT_ID"
    elif event.sequence <= sensor.last_sequence:
        reason = "STALE_SEQUENCE"
    elif event.observed_at > now + 2 or event.observed_at < now - 30:
        reason = "CLOCK_SKEW_OR_STALE"
    elif event.kind.split('.')[0] not in (sensor.kind, "sensor"):
        reason = "SOURCE_KIND_MISMATCH"
    elif not sensor.online and event.kind not in ("sensor.online", "sensor.offline"):
        reason = "SOURCE_OFFLINE"
    row = PhantomEvent(household_id=home.id, event_id=str(event.event_id), device_id=event.device_id,
                       kind=event.kind, observed_at=event.observed_at, received_at=now, run_id=run_id,
                       verdict="REJECTED" if reason else "ACCEPTED", reason=reason or "SERVER_SIMULATOR_SOURCE",
                       accepted_id=None if reason else str(event.event_id),
                       accepted_sequence=None if reason else event.sequence)
    db.add(row)
    if not reason:
        sensor.last_sequence = event.sequence
        if event.kind in ("sensor.offline", "sensor.online"):
            sensor.online = event.kind == "sensor.online"
    db.flush()
    audit(db, "phantom.ingress", household=home.id, attempt_id=row.id, verdict=row.verdict, reason=row.reason)
    if not reason and event.kind.split('.')[0] in ('motion', 'presence', 'lock', 'sensor'):
        # Late evidence appends a revised assessment, never replays an automation
        # or releases a held action. The final request publishes an invalidation.
        from .verifier import assess
        config = db.get(PhantomConfig, home.id)
        triggers = db.scalars(select(PhantomEvent).join(PhantomAssessment, PhantomAssessment.trigger_id == PhantomEvent.id)
            .where(PhantomEvent.household_id == home.id, PhantomEvent.run_id == run_id,
                   PhantomEvent.kind == 'door.open', PhantomEvent.verdict == 'ACCEPTED',
                   PhantomEvent.observed_at >= now-40).distinct().limit(100))
        for trigger in list(triggers):
            assess(db, home, trigger, config, now=now)
    return row
