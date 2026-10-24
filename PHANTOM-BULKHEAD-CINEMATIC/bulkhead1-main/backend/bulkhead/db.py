import time
from uuid import uuid4
from typing import Annotated
from fastapi import Depends
from sqlalchemy import create_engine, String, Integer, Float, Boolean, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session
from .config import settings


def uid():
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(512))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)


class Identity(Base):
    __tablename__ = "identities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    provider: Mapped[str] = mapped_column(String(32))
    subject: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    __table_args__ = (UniqueConstraint("provider", "subject"),)


class SessionRecord(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[float] = mapped_column(Float, index=True)
    authenticated_at: Mapped[float | None] = mapped_column(Float)


class Token(Base):
    __tablename__ = "tokens"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    purpose: Mapped[str] = mapped_column(String(32))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[float] = mapped_column(Float, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class Household(Base):
    __tablename__ = "households"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(100))
    profile: Mapped[str] = mapped_column(String(16), default="Admin")
    policy_revision: Mapped[int] = mapped_column(Integer, default=1)
    sequence: Mapped[int] = mapped_column(Integer, default=0)
    preferences: Mapped[dict] = mapped_column(JSON, default=lambda: {"email_notifications": True})
    simulation: Mapped[dict] = mapped_column(JSON, default=lambda: {"scenario": None, "tick": 0, "baselines": {}})


class Membership(Base):
    __tablename__ = "memberships"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="Viewer")
    expires_at: Mapped[float | None] = mapped_column(Float, index=True)
    __table_args__ = (UniqueConstraint("household_id", "user_id"),)


class DeviceRecord(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (UniqueConstraint("household_id", "id"),)


class VendorAccount(Base):
    __tablename__ = "vendor_accounts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    data: Mapped[dict] = mapped_column(JSON)


class PolicyRecord(Base):
    __tablename__ = "policies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[float | None] = mapped_column(Float, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    __table_args__ = (Index("ix_policy_house_device_active", "household_id", "device_id", "active"),)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    node_id: Mapped[str] = mapped_column(String(36))
    fingerprint: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(16), default="open")
    alert: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    __table_args__ = (Index("ix_incident_home_status", "household_id", "status"),)


class Action(Base):
    __tablename__ = "actions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    command_key: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(32))
    node_id: Mapped[str] = mapped_column(String(36))
    mode: Mapped[str] = mapped_column(String(16), default="simulation")
    policy_revision: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(24), default="planned")
    previous: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    expires_at: Mapped[float | None] = mapped_column(Float, index=True)
    __table_args__ = (UniqueConstraint("household_id", "command_key"),)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str | None] = mapped_column(ForeignKey("households.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(64))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)


class EventRecord(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    __table_args__ = (UniqueConstraint("household_id", "sequence"),)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str | None] = mapped_column(ForeignKey("households.id"), index=True)
    dedupe_key: Mapped[str] = mapped_column(String(255), unique=True)
    kind: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    state: Mapped[str] = mapped_column(String(16), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[float] = mapped_column(Float, default=time.time)
    lease_until: Mapped[float] = mapped_column(Float, default=0)
    lease_owner: Mapped[str | None] = mapped_column(String(36))
    error: Mapped[str | None] = mapped_column(String(255))
    __table_args__ = (Index("ix_jobs_due", "state", "available_at", "lease_until"),)


class WorkerHealth(Base):
    __tablename__ = "worker_health"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    heartbeat: Mapped[float] = mapped_column(Float)
    error: Mapped[str | None] = mapped_column(String(255))


class Throttle(Base):
    __tablename__ = "throttles"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[float] = mapped_column(Float, index=True)


class AdvisoryCache(Base):
    __tablename__ = "advisory_cache"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[float] = mapped_column(Float)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    credential_hash: Mapped[str] = mapped_column(String(64), unique=True)
    heartbeat: Mapped[float] = mapped_column(Float, default=0)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


engine = create_engine(settings().database_url, pool_pre_ping=True,
                       **({"connect_args": {"check_same_thread": False}} if settings().database_url.startswith("sqlite") else {"pool_size": 10, "max_overflow": 10}))
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        with db.begin():
            yield db


DB = Annotated[Session, Depends(get_db, scope="function")]
