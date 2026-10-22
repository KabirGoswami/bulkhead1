import pytest
import json
from models import HomeState, Device, Account
from audit import run_audit, apply_fix

def test_audit_firmware_age():
    devices = [
        Device(id="d1", name="Bulb", type="bulb", vendor="V1", zone="iot", criticality="low", firmware_age_days=400, allowed_destinations=[], allowed_peers=[], account_ids=[]),
        Device(id="d2", name="Lock", type="lock", vendor="V2", zone="iot", criticality="high", firmware_age_days=10, allowed_destinations=[], allowed_peers=[], account_ids=[])
    ]
    accounts = []
    state = HomeState(devices=devices, accounts=accounts)
    findings = run_audit(state)

    firmware_findings = [f for f in findings if "firmware" in f.id]
    assert len(firmware_findings) == 1
    assert firmware_findings[0].device_id == "d1"
    assert firmware_findings[0].severity == "medium"

def test_audit_mfa_disabled():
    devices = []
    accounts = [
        Account(id="a1", name="Acc1", mfa_enabled=False, password_strength="strong", linked_device_ids=[]),
        Account(id="a2", name="Acc2", mfa_enabled=True, password_strength="strong", linked_device_ids=[])
    ]
    state = HomeState(devices=devices, accounts=accounts)
    findings = run_audit(state)

    mfa_findings = [f for f in findings if "mfa" in f.id]
    assert len(mfa_findings) == 1
    assert mfa_findings[0].account_id == "a1"
    assert mfa_findings[0].severity == "critical"

def test_apply_fix_mfa():
    devices = []
    accounts = [Account(id="a1", name="Acc1", mfa_enabled=False, password_strength="strong", linked_device_ids=[])]
    state = HomeState(devices=devices, accounts=accounts)

    # Create a finding for MFA
    from models import AuditFinding
    finding = AuditFinding(
        id="mfa_a1",
        account_id="a1",
        severity="critical",
        title="MFA Disabled",
        explanation="MFA off",
        fix_type="ENABLE_MFA",
        fix_params={"mfa_enabled": True}
    )

    new_state = apply_fix(state, finding)
    assert new_state.accounts[0].mfa_enabled is True

def test_audit_flat_network():
    devices = [
        Device(id="d1", name="Bulb", type="bulb", vendor="V1", zone="main", criticality="low", firmware_age_days=10, allowed_destinations=[], allowed_peers=[], account_ids=[])
    ]
    accounts = []
    state = HomeState(devices=devices, accounts=accounts)
    findings = run_audit(state)

    zone_findings = [f for f in findings if "zone" in f.id]
    assert len(zone_findings) == 1
    assert zone_findings[0].severity == "high"
