from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class Device(BaseModel):
    id: str
    name: str
    type: str
    vendor: str
    zone: str
    criticality: str  # low, medium, high, safety
    firmware_age_days: int
    allowed_destinations: List[str]
    allowed_peers: List[str]
    account_ids: List[str]

class Account(BaseModel):
    id: str
    name: str
    mfa_enabled: bool
    password_strength: str # weak, medium, strong
    linked_device_ids: List[str]

class AuditFinding(BaseModel):
    id: str
    device_id: Optional[str] = None
    account_id: Optional[str] = None
    severity: str # low, medium, high, critical
    title: str
    explanation: str
    fix_type: str # e.g., "ENABLE_MFA", "MOVE_ZONE", "UPDATE_FIRMWARE", "RESTRICT_ACCESS"
    fix_params: Dict[str, Any] = {}

class HomeState(BaseModel):
    devices: List[Device]
    accounts: List[Account]
