from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime

class ResponseAction(BaseModel):
    id: str
    alert_id: str
    action_type: str # "CONTAIN", "REVOKE", "NOTIFY"
    node_id: str
    executed_at: datetime
    undo_token: str
    previous_state: Dict[str, Any]
