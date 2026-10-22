from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Alert(BaseModel):
    id: str
    node_id: str
    confidence: str # "low" | "medium" | "high"
    reason_codes: List[str]
    explanation: str
    timestamp: datetime
