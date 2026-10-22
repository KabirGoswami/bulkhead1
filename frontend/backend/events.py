from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class FlowEvent(BaseModel):
    ts: datetime
    src: str
    dst: str
    port: int
    bytes: int

class AuthEvent(BaseModel):
    ts: datetime
    account_id: str
    client: str
    geo: str
    result: str # "success" | "fail"
