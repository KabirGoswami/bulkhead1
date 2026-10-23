from typing import List, Dict, Any
from models import HomeState, AuditFinding

def run_audit(state: HomeState) -> List[AuditFinding]:
    findings = []

    # --- Device Checks ---
    for device in state.devices:
        # 1. Firmware Age
        if device.firmware_age_days > 365:
            findings.append(AuditFinding(
                id=f"firmware_{device.id}",
                device_id=device.id,
                severity="medium" if device.firmware_age_days < 730 else "high",
                title="Outdated Firmware",
                explanation=f"{device.name} firmware is {device.firmware_age_days} days old.",
                fix_type="UPDATE_FIRMWARE",
                fix_params={"firmware_age_days": 0}
            ))

        # 2. Flat Network Placement (IoT in main/work zone)
        # IoT types: bulb, plug, speaker, etc.
        iot_types = ["bulb", "plug", "speaker", "camera", "lock"]
        if device.type in iot_types and device.zone in ["main", "work"]:
            findings.append(AuditFinding(
                id=f"zone_{device.id}",
                device_id=device.id,
                severity="high",
                title="Flat Network Placement",
                explanation=f"IoT device {device.name} is in the {device.zone} zone. It should be isolated in the 'iot' or 'guest' zone.",
                fix_type="MOVE_ZONE",
                fix_params={"zone": "iot"}
            ))

    # --- Account Checks ---
    for account in state.accounts:
        # 3. MFA Disabled
        if not account.mfa_enabled:
            findings.append(AuditFinding(
                id=f"mfa_{account.id}",
                account_id=account.id,
                severity="critical",
                title="MFA Disabled",
                explanation=f"Account {account.name} does not have Multi-Factor Authentication enabled.",
                fix_type="ENABLE_MFA",
                fix_params={"mfa_enabled": True}
            ))

        # 4. Weak Password
        if account.password_strength == "weak":
            findings.append(AuditFinding(
                id=f"pwd_{account.id}",
                account_id=account.id,
                severity="high",
                title="Weak Password",
                explanation=f"Account {account.name} has a weak password.",
                fix_type="STRENGTHEN_PASSWORD",
                fix_params={"password_strength": "strong"}
            ))

        # 5. Account Over-shared
        if len(account.linked_device_ids) > 5:
            findings.append(AuditFinding(
                id=f"shared_{account.id}",
                account_id=account.id,
                severity="medium",
                title="Over-shared Account",
                explanation=f"Account {account.name} is linked to {len(account.linked_device_ids)} devices. This increases the blast radius if the account is compromised.",
                fix_type="SPLIT_ACCOUNT",
                fix_params={}, executable=False
            ))

    return findings

def apply_fix(state: HomeState, finding: AuditFinding) -> HomeState:
    if not finding.executable or not finding.fix_params:
        raise ValueError("This operation requires vendor guidance")
    # Mutate the state based on fix_type
    if finding.device_id:
        for device in state.devices:
            if device.id == finding.device_id:
                for key, value in finding.fix_params.items():
                    setattr(device, key, value)

    if finding.account_id:
        for account in state.accounts:
            if account.id == finding.account_id:
                for key, value in finding.fix_params.items():
                    setattr(account, key, value)

    return state
