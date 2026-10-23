"""Frozen PHANTOM 0002 schema; independent of future ORM edits."""
import time
from uuid import uuid4
from sqlalchemy import String, Integer, Float, Boolean, JSON, ForeignKey, UniqueConstraint, Index, Table, Column
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

def uid():
    return str(uuid4())

class Base(DeclarativeBase):
    pass

# Foreign key targets already created by 0001; never created/dropped here.
Table("households", Base.metadata, Column("id", String(36), primary_key=True))
Table("users", Base.metadata, Column("id", String(36), primary_key=True))

class PhantomConfig(Base):
    __tablename__ = "phantom_config"
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    window_seconds: Mapped[int] = mapped_column(Integer, default=10)
    retention_days: Mapped[int] = mapped_column(Integer, default=7)
    rules: Mapped[dict] = mapped_column(JSON, default=lambda: {"hallway_light": True, "entry_lock": True})


class PhantomSensor(Base):
    __tablename__ = "phantom_sensors"
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), primary_key=True)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(24))
    location: Mapped[str] = mapped_column(String(64))
    last_sequence: Mapped[int] = mapped_column(Integer, default=0)
    online: Mapped[bool] = mapped_column(Boolean, default=True)


class PhantomEvent(Base):
    """Accepted IDs/sequences remain as replay tombstones after metadata expires."""
    __tablename__ = "phantom_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    event_id: Mapped[str] = mapped_column(String(36))
    device_id: Mapped[str] = mapped_column(String(36))
    accepted_id: Mapped[str | None] = mapped_column(String(36))
    accepted_sequence: Mapped[int | None] = mapped_column(Integer)
    run_id: Mapped[str | None] = mapped_column(String(36), index=True)
    kind: Mapped[str | None] = mapped_column(String(32))
    observed_at: Mapped[float | None] = mapped_column(Float)
    received_at: Mapped[float] = mapped_column(Float, default=time.time)
    verdict: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str] = mapped_column(String(40))
    __table_args__ = (UniqueConstraint("household_id", "accepted_id"),
                     UniqueConstraint("household_id", "device_id", "accepted_sequence"))


class PhantomAssessment(Base):
    __tablename__ = "phantom_assessments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    trigger_id: Mapped[str] = mapped_column(ForeignKey("phantom_events.id"), index=True)
    run_id: Mapped[str | None] = mapped_column(String(36), index=True)
    state: Mapped[str] = mapped_column(String(16))
    evidence: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    expires_at: Mapped[float] = mapped_column(Float)


class PhantomActuator(Base):
    __tablename__ = "phantom_actuators"
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), primary_key=True)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    state: Mapped[str] = mapped_column(String(24))
    executions: Mapped[int] = mapped_column(Integer, default=0)


class PhantomDecision(Base):
    __tablename__ = "phantom_decisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    command_key: Mapped[str] = mapped_column(String(64))
    run_id: Mapped[str | None] = mapped_column(String(36), index=True)
    assessment_id: Mapped[str | None] = mapped_column(ForeignKey("phantom_assessments.id"))
    target: Mapped[str] = mapped_column(String(36))
    command: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON)
    payload_digest: Mapped[str] = mapped_column(String(64))
    policy_revision: Mapped[int] = mapped_column(Integer)
    home_revision: Mapped[int] = mapped_column(Integer)
    decision: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    executed_at: Mapped[float | None] = mapped_column(Float)
    latency_ms: Mapped[float] = mapped_column(Float)
    __table_args__ = (UniqueConstraint("household_id", "command_key"),)


class PhantomApproval(Base):
    __tablename__ = "phantom_approvals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    command_id: Mapped[str] = mapped_column(ForeignKey("phantom_decisions.id"), unique=True)
    requester_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[str] = mapped_column(String(64))
    payload_digest: Mapped[str] = mapped_column(String(64))
    policy_revision: Mapped[int] = mapped_column(Integer)
    home_revision: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[float] = mapped_column(Float)
    consumed_at: Mapped[float | None] = mapped_column(Float)
    approver_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    outcome: Mapped[str | None] = mapped_column(String(32))


class PhantomRun(Base):
    __tablename__ = "phantom_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    scenario: Mapped[str] = mapped_column(String(32))
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)



metadata = Base.metadata
