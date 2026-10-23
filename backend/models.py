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
    seed_key: Optional[str] = None
    isolated: bool = False
    approval: str = "approved"
    firmware_version: Optional[str] = None
    product_cpe: Optional[str] = None
    trusted_ipv4: Optional[str] = None
    trusted_mac: Optional[str] = None
    policy_peers: Optional[List[str]] = None
    policy_destinations: Optional[List[str]] = None

class Account(BaseModel):
    id: str
    name: str
    mfa_enabled: bool
    password_strength: str # weak, medium, strong
    linked_device_ids: List[str]
    seed_key: Optional[str] = None
    access_revoked: bool = False

class AuditFinding(BaseModel):
    id: str
    device_id: Optional[str] = None
    account_id: Optional[str] = None
    severity: str # low, medium, high, critical
    title: str
    explanation: str
    fix_type: str # e.g., "ENABLE_MFA", "MOVE_ZONE", "UPDATE_FIRMWARE", "RESTRICT_ACCESS"
    fix_params: Dict[str, Any] = {}
    executable: bool = True

class HomeState(BaseModel):
    devices: List[Device]
    accounts: List[Account]
