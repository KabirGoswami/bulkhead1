import ipaddress
import re
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from models import Device
from audit import run_audit, apply_fix
from .db import DB, DeviceRecord, AuditEvent, Action, uid
from .security import CurrentUser, household_access, iso
from .service import load_state, save_state, changed, snapshot

router = APIRouter(prefix="/api/v1/households/{household_id}", tags=["inventory"])


class DeviceInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(min_length=1, max_length=32)
    vendor: str = Field(min_length=1, max_length=100)
    zone: Literal["main", "iot", "work", "guest"] = "iot"
    criticality: Literal["low", "medium", "high", "safety"] = "medium"
    approval: Literal["pending", "approved", "rejected"] = "pending"
    firmware_age_days: int = Field(default=0, ge=0, le=36500)
    firmware_version: str | None = Field(default=None, max_length=100)
    product_cpe: str | None = Field(default=None, max_length=512)
    trusted_ipv4: str | None = None
    trusted_mac: str | None = None

    @field_validator("trusted_mac")
    @classmethod
    def mac(cls, value):
        if value and not re.fullmatch(r"[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}", value):
            raise ValueError("Expected a MAC address")
        return value.lower() if value else None


def validate_device(db, home, body, exclude=None):
    if body.trusted_ipv4:
        try:
            address = ipaddress.IPv4Address(body.trusted_ipv4)
            subnet = {"main": 10, "iot": 20, "work": 30, "guest": 40}[body.zone]
            if address not in ipaddress.ip_network(f"192.168.{subnet}.0/24") or int(str(address).split(".")[-1]) not in range(10, 255):
                raise ValueError()
        except ValueError:
            raise HTTPException(422, "Trusted IPv4 must be a non-management lab address (.10 through .254) in its zone")
    if bool(body.trusted_ipv4) != bool(body.trusted_mac):
        raise HTTPException(422, "Trusted mapping requires both IPv4 and MAC")
    if body.product_cpe and (not body.product_cpe.startswith("cpe:2.3:") or len(body.product_cpe.split(":")) != 13):
        raise HTTPException(422, "Expected a complete CPE 2.3 name")
    for row in db.scalars(select(DeviceRecord).where(DeviceRecord.household_id == home.id)):
        if row.id != exclude and ((body.trusted_ipv4 and row.data.get("trusted_ipv4") == body.trusted_ipv4) or (body.trusted_mac and row.data.get("trusted_mac") == body.trusted_mac)):
            raise HTTPException(409, "Trusted address is already mapped to another device")


@router.get("/state")
@router.get("/topology")
@router.get("/risk")
def state(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    return snapshot(db, home)


@router.get("/devices")
def devices(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    return load_state(db, home).model_dump(mode="json")["devices"]


@router.post("/devices", status_code=201)
def create_device(household_id: str, body: DeviceInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    validate_device(db, home, body)
    device = Device(id=uid(), **body.model_dump(), allowed_destinations=[], allowed_peers=[], account_ids=[])
    db.add(DeviceRecord(id=device.id, household_id=home.id, data=device.model_dump(mode="json")))
    home.policy_revision += 1
    changed(db, home, "device.created", actor=user.id, device_id=device.id)
    return device


@router.put("/devices/{device_id}")
def update_device(household_id: str, device_id: str, body: DeviceInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    row = db.scalar(select(DeviceRecord).where(DeviceRecord.household_id == home.id, DeviceRecord.id == device_id))
    if not row:
        raise HTTPException(404, "Device not found")
    active = db.scalar(select(Action.id).where(Action.household_id == home.id, Action.node_id == device_id,
                       Action.mode == "openwrt", Action.state.in_(["planned", "applied", "verified"])))
    if active and (body.trusted_ipv4 != row.data.get("trusted_ipv4") or body.trusted_mac != row.data.get("trusted_mac")):
        raise HTTPException(409, "Restore the active gateway quarantine before changing its mapping")
    validate_device(db, home, body, device_id)
    row.data = {**row.data, **body.model_dump()}
    home.policy_revision += 1
    changed(db, home, "device.updated", actor=user.id, device_id=device_id)
    return row.data


@router.get("/audit")
def audit_findings(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    return run_audit(load_state(db, home))


class FixInput(BaseModel):
    finding_id: str = Field(max_length=100)


@router.post("/audit/fix")
def fix(household_id: str, body: FixInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    state = load_state(db, home)
    finding = next((f for f in run_audit(state) if f.id == body.finding_id), None)
    if not finding:
        raise HTTPException(404, "Finding no longer exists")
    if not finding.executable:
        raise HTTPException(409, "Guidance only: split vendor access in the vendor application")
    apply_fix(state, finding)
    save_state(db, home, state)
    home.policy_revision += 1
    changed(db, home, "audit.simulated_fix", actor=user.id, finding_id=finding.id)
    return {"state": "verified", "execution_mode": "simulation", "finding_id": finding.id}


@router.get("/audit-events")
def audit_events(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    rows = db.scalars(select(AuditEvent).where(AuditEvent.household_id == home.id).order_by(AuditEvent.created_at.desc()).limit(500))
    return [{"id": e.id, "kind": e.kind, "actor_id": e.actor_id, "timestamp": iso(e.created_at), "data": e.data} for e in rows]


@router.get("/blast/{node_id}")
def blast(household_id: str, node_id: str, db: DB, user: CurrentUser):
    from blast import get_reachable_nodes
    home, _ = household_access(db, household_id, user.id)
    reached = get_reachable_nodes(load_state(db, home), node_id)
    if not reached:
        raise HTTPException(404, "Node not found")
    return {"reachable": sorted(reached), "count": len(reached)}
