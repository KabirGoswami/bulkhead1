import pytest
from models import HomeState, Device, Account
from blast import get_reachable_nodes, calculate_exposure_score_fixed

def test_reachability_zone():
    # Two devices in same zone should reach each other
    devices = [
        Device(id="d1", name="D1", type="bulb", vendor="V1", zone="main", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[]),
        Device(id="d2", name="D2", type="bulb", vendor="V1", zone="main", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[])
    ]
    state = HomeState(devices=devices, accounts=[])
    reachable = get_reachable_nodes(state, "d1")
    assert "d2" in reachable

def test_reachability_account():
    # Device linked to account, account linked to other device
    devices = [
        Device(id="d1", name="D1", type="bulb", vendor="V1", zone="iot", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=["acc1"]),
        Device(id="d2", name="D2", type="bulb", vendor="V1", zone="iot", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=["acc1"])
    ]
    accounts = [
        Account(id="acc1", name="Acc1", mfa_enabled=True, password_strength="strong", linked_device_ids=["d1", "d2"])
    ]
    state = HomeState(devices=devices, accounts=accounts)
    reachable = get_reachable_nodes(state, "d1")
    assert "acc1" in reachable
    assert "d2" in reachable

def test_reachability_isolated():
    # Different zones, no shared accounts
    devices = [
        Device(id="d1", name="D1", type="bulb", vendor="V1", zone="main", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[]),
        Device(id="d2", name="D2", type="bulb", vendor="V1", zone="iot", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[])
    ]
    state = HomeState(devices=devices, accounts=[])
    reachable = get_reachable_nodes(state, "d1")
    assert "d2" not in reachable

def test_exposure_score_calculation():
    # Simple case: all devices reachable from one node
    devices = [
        Device(id="d1", name="D1", type="bulb", vendor="V1", zone="main", criticality="low", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[]),
        Device(id="d2", name="D2", type="bulb", vendor="V1", zone="main", criticality="high", firmware_age_days=0, allowed_destinations=[], allowed_peers=[], account_ids=[])
    ]
    state = HomeState(devices=devices, accounts=[])
    # Weights: low=1, high=7. Total=8. Max impact = 8. Score = 100%
    score = calculate_exposure_score_fixed(state)
    assert score == 100.0
