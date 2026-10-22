from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel
from models import HomeState, Device, Account
from alert_model import Alert
from action_model import ResponseAction


class ResponseAction(BaseModel):
    id: str
    alert_id: str
    action_type: str # "CONTAIN", "REVOKE", "NOTIFY"
    node_id: str
    executed_at: datetime
    undo_token: str
    previous_state: Dict[str, Any]

class PolicyEngine:
    def __init__(self):
        # Autonomy Ladder: Level 1 (Auto), Level 2 (Confirm), Level 3 (Notify Only)
        self.autonomy_map = {
            "low": 1,      # Auto-contain
            "medium": 1,   # Auto-contain
            "high": 2,     # Confirm
            "safety": 3     # Notify only
        }
        self.undo_stack: List[ResponseAction] = []

    def get_action_level(self, node_id: str, state: HomeState) -> int:
        # Find device criticality
        device = next((d for d in state.devices if d.id == node_id), None)
        if device:
            return self.autonomy_map.get(device.criticality, 2)

        # Accounts default to Level 2 (Confirm)
        return 2

    def determine_response(self, alert: Alert, state: HomeState) -> Dict[str, Any]:
        level = self.get_action_level(alert.node_id, state)

        response = {
            "level": level,
            "action": "NOTIFY",
            "requires_confirmation": False,
            "can_auto_act": False,
            "explanation": ""
        }

        if level == 1:
            response["action"] = "CONTAIN"
            response["can_auto_act"] = True
            response["explanation"] = "Low/Medium criticality device: Auto-containing to prevent spread."
        elif level == 2:
            response["action"] = "CONTAIN"
            response["requires_confirmation"] = True
            response["explanation"] = "High criticality device: User confirmation required before containment."
        elif level == 3:
            response["action"] = "NOTIFY"
            response["explanation"] = "Safety-critical device: Manual intervention required. Auto-containment disabled."

        return response

    def execute_action(self, alert: Alert, action_type: str, state: HomeState) -> Optional[ResponseAction]:
        # Implement actual state mutation for containment
        # Containment = restrict allowed_destinations to vendor cloud, clear allowed_peers
        device = next((d for d in state.devices if d.id == alert.node_id), None)
        if not device: return None

        # Save state for undo
        prev_state = {
            "allowed_destinations": list(device.allowed_destinations),
            "allowed_peers": list(device.allowed_peers)
        }

        if action_type == "CONTAIN":
            # Example: Only allow vendor cloud (simplified: keep first destination)
            vendor_cloud = device.allowed_destinations[0] if device.allowed_destinations else "*"
            device.allowed_destinations = [vendor_cloud]
            device.allowed_peers = []

        action = ResponseAction(
            id=f"action_{int(datetime.now().timestamp())}",
            alert_id=alert.id,
            action_type=action_type,
            node_id=alert.node_id,
            executed_at=datetime.now(),
            undo_token=f"undo_{action_type}_{alert.node_id}",
            previous_state=prev_state
        )
        self.undo_stack.append(action)
        return action

    def undo(self, action_id: str, state: HomeState) -> bool:
        action = next((a for a in self.undo_stack if a.id == action_id), None)
        if not action: return False

        device = next((d for d in state.devices if d.id == action.node_id), None)
        if device:
            device.allowed_destinations = action.previous_state["allowed_destinations"]
            device.allowed_peers = action.previous_state["allowed_peers"]

        self.undo_stack = [a for a in self.undo_stack if a.id != action_id]
        return True
