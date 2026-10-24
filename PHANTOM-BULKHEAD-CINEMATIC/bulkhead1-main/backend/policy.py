from datetime import datetime, timezone
from uuid import uuid4
from models import HomeState
from alert_model import Alert
from action_model import ResponseAction
from profiles import PROFILES


class PolicyEngine:
    def __init__(self):
        self.autonomy_map = {"low": 1, "medium": 1, "high": 2, "safety": 3}
        self.undo_stack = []

    def get_action_level(self, node_id, state, profile="Admin"):
        device = next((d for d in state.devices if d.id == node_id), None)
        if not device:
            return 2
        selected = PROFILES[profile]
        criticality = selected.criticality_overrides.get(device.seed_key or device.id, device.criticality)
        return selected.autonomy_overrides.get(criticality, self.autonomy_map.get(criticality, 2))

    def determine_response(self, alert, state, profile="Admin"):
        level = self.get_action_level(alert.node_id, state, profile)
        account = next((a for a in state.accounts if a.id == alert.node_id), None)
        action = "NOTIFY" if level == 3 else "REVOKE" if account else "CONTAIN"
        return {"level": level, "action": action, "requires_confirmation": level == 2,
                "can_auto_act": level == 1,
                "explanation": {1: "Simulation policy permits automatic containment.",
                                2: "Confirmation is required before changing simulated access.",
                                3: "Notify only: review this safety-sensitive device manually."}[level]}

    def execute_action(self, alert, action_type, state):
        prior = next((a for a in self.undo_stack if a.alert_id == alert.id), None)
        if prior:
            return prior
        device = next((d for d in state.devices if d.id == alert.node_id), None)
        account = next((a for a in state.accounts if a.id == alert.node_id), None)
        if action_type == "CONTAIN" and device:
            previous = {"allowed_destinations": list(device.allowed_destinations),
                        "allowed_peers": list(device.allowed_peers), "isolated": device.isolated}
            device.isolated = True
            device.allowed_destinations = device.allowed_destinations[:1]
            device.allowed_peers = []
        elif action_type == "REVOKE" and account:
            previous = {"access_revoked": account.access_revoked}
            account.access_revoked = True
        else:
            raise ValueError("Unsupported action or unknown node")
        action = ResponseAction(id=str(uuid4()), alert_id=alert.id, action_type=action_type,
                                node_id=alert.node_id, executed_at=datetime.now(timezone.utc),
                                undo_token=str(uuid4()), previous_state=previous)
        self.undo_stack.append(action)
        return action

    def undo(self, action_id, state):
        action = next((a for a in self.undo_stack if a.id == action_id), None)
        if not action:
            return False
        node = next((n for n in [*state.devices, *state.accounts] if n.id == action.node_id), None)
        if not node:
            return False
        for key, value in action.previous_state.items():
            setattr(node, key, value)
        self.undo_stack.remove(action)
        return True
