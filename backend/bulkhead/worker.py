"""Supervised outbox worker. Run independently of API: python -m bulkhead.worker."""
import logging
import signal
import smtplib
import time
from email.message import EmailMessage
from sqlalchemy import select, or_, and_
from .db import SessionLocal, Job, Household, WorkerHealth, uid, Agent, Membership, User
from .service import tick
from .config import settings

log = logging.getLogger("bulkhead.worker")
RUNNING = True


def claim(worker_id):
    with SessionLocal.begin() as db:
        now = time.time()
        job = db.scalar(select(Job).where(Job.available_at <= now,
                        or_(Job.state == "pending", and_(Job.state == "running", Job.lease_until < now)))
                        .order_by(Job.available_at).with_for_update(skip_locked=True).limit(1))
        if not job:
            return None
        job.state, job.lease_until, job.lease_owner = "running", now+60, worker_id
        job.attempts += 1
        return job.id


def send_email(payload):
    message = EmailMessage()
    message["From"] = settings().smtp_sender
    message["To"] = payload["recipient"]
    message["Subject"] = payload["subject"]
    # Stable Message-ID supports downstream deduplication across an ambiguous SMTP retry.
    message["Message-ID"] = f"<{payload['message_id']}@bulkhead.local>"
    message.set_content(payload["text"])
    with smtplib.SMTP(settings().smtp_host, settings().smtp_port, timeout=10) as smtp:
        smtp.send_message(message)


def process(job_id, worker_id):
    with SessionLocal.begin() as db:
        job = db.scalar(select(Job).where(Job.id == job_id, Job.state == "running", Job.lease_owner == worker_id).with_for_update())
        if not job or job.lease_until < time.time():
            return
        if job.kind == "tick":
            home = db.scalar(select(Household).where(Household.id == job.household_id).with_for_update())
            if home:
                tick(db, home)
        elif job.kind == "email":
            allowed = True
            if job.household_id:
                home = db.get(Household, job.household_id)
                # Invitations are sent before membership exists; incident recipients must still have access.
                if job.dedupe_key.startswith("incident:"):
                    user = db.scalar(select(User).where(User.email == job.payload["recipient"]))
                    membership = db.scalar(select(Membership).where(Membership.household_id == home.id, Membership.user_id == user.id)) if home and user else None
                    allowed = bool(home and home.preferences.get("email_notifications", True) and membership and
                                   (not membership.expires_at or membership.expires_at > time.time()))
            if allowed:
                send_email({**job.payload, "message_id": job.id})
        else:
            raise ValueError("Unknown job kind")
        job.state, job.error = "complete", None
        job.payload = {}  # Expunge delivered email links from the outbox.


def iteration(worker_id):
    with SessionLocal.begin() as db:
        db.merge(WorkerHealth(id=worker_id, heartbeat=time.time(), error=None))
    job_id = claim(worker_id)
    if not job_id:
        return False
    try:
        process(job_id, worker_id)
    except Exception as exc:
        # Never log job payloads, credentials, tokens or addresses.
        with SessionLocal.begin() as db:
            job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
            if job and job.lease_owner == worker_id:
                job.error = type(exc).__name__
                job.state = "failed" if job.kind == "email" and job.attempts >= 8 else "pending"
                job.available_at = time.time()+min(60, 2**min(job.attempts, 6))
            db.merge(WorkerHealth(id=worker_id, heartbeat=time.time(), error=type(exc).__name__))
        log.warning("Job failed: %s", type(exc).__name__)
    return True


def stop(*_):
    global RUNNING
    RUNNING = False


def main():
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    worker_id = uid()
    logging.basicConfig(level=logging.INFO)
    while RUNNING:
        try:
            busy = iteration(worker_id)
            if not busy:
                time.sleep(0.25)
        except Exception as exc:
            log.warning("Worker reconnecting after %s", type(exc).__name__)
            time.sleep(2)


if __name__ == "__main__":
    main()
