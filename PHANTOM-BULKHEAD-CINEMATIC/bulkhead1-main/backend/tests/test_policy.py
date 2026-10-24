import pytest
from models import HomeState, Device, Account
from alert_model import Alert
from policy import PolicyEngine
from datetime import datetime

def test_autonomy_ladder():
    state = HomeState(
        devices=[
            Device(id="low_dev", name="Bulb", type="bulb", vendor="V1", zone="iot", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[]),
            Device(id="high_dev", name="Lock", type="lock", vendor="V1", zone="iot", criticality="high", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[]),
            Device(id="safety_dev", name="Heat", type="thermostat", vendor="V1", zone="iot", criticality="safety", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[]),
        ],
        accounts=[]
    )
    policy = PolicyEngine()

    alert = Alert(id="a1", node_id="low_dev", confidence="high", reason_codes=["X"], explanation="Y", timestamp=datetime.now())
    res_low = policy.determine_response(alert, state)
    assert res_low["level"] == 1
    assert res_low["can_auto_act"] is True

    alert.node_id = "high_dev"
    res_high = policy.determine_response(alert, state)
    assert res_high["level"] == 2
    assert res_high["requires_confirmation"] is True

    alert.node_id = "safety_dev"
    res_safety = policy.determine_response(alert, state)
    assert res_safety["level"] == 3
    assert res_safety["action"] == "NOTIFY"

def test_containment_and_undo():
    device = Device(id="d1", name="Dev", type="bulb", vendor="V1", zone="iot", criticality="low", firmware_age_days=0, allowed_destinations=["cloud.com", "evil.com"], allowed_peers=["peer1"], account_ids=[])
    state = HomeState(devices=[device], accounts=[])
    policy = PolicyEngine()
    alert = Alert(id="a1", node_id="d1", confidence="high", reason_codes=["X"], explanation="Y", timestamp=datetime.now())

    # Execute containment
    action = policy.execute_action(alert, "CONTAIN", state)
    assert action is not None
    assert device.allowed_destinations == ["cloud.com"]
    assert device.allowed_peers == []

    # Undo
    success = policy.undo(action.id, state)
    assert success is True
    assert device.allowed_destinations == ["cloud.com", "evil.com"]
    assert device.allowed_peers == ["peer1"]
