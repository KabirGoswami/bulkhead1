"""Bounded-detail retention while keeping durable replay guards and audit IDs."""
import time
from sqlalchemy import update
from ..db import PhantomEvent, PhantomAssessment


def purge_metadata(db, home, config):
    cutoff = time.time() - config.retention_days * 86400
    db.execute(update(PhantomEvent).where(PhantomEvent.household_id == home.id,
        PhantomEvent.received_at < cutoff, PhantomEvent.kind != None).values(kind=None, observed_at=None))
    db.execute(update(PhantomAssessment).where(PhantomAssessment.household_id == home.id,
        PhantomAssessment.created_at < cutoff).values(evidence={}))
