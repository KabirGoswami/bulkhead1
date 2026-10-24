from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class FlowEvent(BaseModel):
    ts: datetime
    src: str
    dst: str
    port: int
    bytes: int
    # Set only by a trusted producer after matching configured vendor rules.
    verified_vendor_update: bool = False

class AuthEvent(BaseModel):
    ts: datetime
    account_id: str
    client: str
    geo: str
    result: str # "success" | "fail"


class VendorCommandEvent(BaseModel):
    ts: datetime
    account_id: str
    device_id: str
    operation: str
    execution_mode: str = "simulation"
