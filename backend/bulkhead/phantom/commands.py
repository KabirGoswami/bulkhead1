"""The sole policy gate for protected virtual actuation; no gateway imports."""
import json
import time
from fastapi import HTTPException
from sqlalchemy import select
from ..db import (PhantomActuator, PhantomDecision, PhantomApproval, PhantomAssessment,
                  PhantomEvent, SessionRecord, uid)
from ..security import digest, household_access, audit
from .verifier import assess


def binding(home_id, actor_id, target, command, payload):
    return digest(json.dumps([home_id, actor_id, target, command, payload], sort_keys=True, separators=(',', ':')))


def _execute(db, home, decision):
    """Only persisted ALLOW decisions can change state. Protected grants are consumed first."""
    if decision.decision != "ALLOW" or decision.executed_at is not None:
        return
    if decision.command == "unlock":
        grant = db.scalar(select(PhantomApproval).where(PhantomApproval.household_id == home.id,
                          PhantomApproval.command_id == decision.id, PhantomApproval.outcome == "approve"))
        if not grant or not grant.consumed_at:
            raise HTTPException(409, "A consumed exact-action owner approval is required")
    actuator = db.get(PhantomActuator, (home.id, decision.target))
    actuator.state = {"turn_on": "on", "turn_off": "off", "unlock": "unlocked", "reset_fixture": "locked"}[decision.command]
    actuator.executions += 1
    decision.executed_at = time.time()
    audit(db, "phantom.executed", actor=decision.actor_id, household=home.id, command_id=decision.id,
          target=decision.target, command=decision.command, execution_mode="simulation")


def propose(db, home, config, actor, session, body, *, run_id=None):
    started = time.perf_counter()
    entered_at = time.time()
    payload = {"assessment_id": str(body.assessment_id) if body.assessment_id else None}
    checksum = binding(home.id, actor.id, body.target, body.command, payload)
    previous = db.scalar(select(PhantomDecision).where(PhantomDecision.household_id == home.id,
                         PhantomDecision.command_key == str(body.command_key)))
    if previous:
        if previous.payload_digest != checksum:
            raise HTTPException(409, "Command key belongs to a different exact action")
        return previous
    if (body.target, body.command) not in (("hallway_light", "turn_on"), ("hallway_light", "turn_off"), ("entry_lock", "unlock")):
        raise HTTPException(422, "Unsupported target/command combination")
    assessment = None
    if body.assessment_id:
        assessment = db.scalar(select(PhantomAssessment).where(PhantomAssessment.household_id == home.id,
                                PhantomAssessment.id == str(body.assessment_id)))
        if not assessment:
            raise HTTPException(404, "Assessment not found")
    verdict, reason = "ALLOW", "ROUTINE_MANUAL_CONTROL" if not assessment else "ROUTINE_CONVENIENCE"
    if assessment and (assessment.state == "REJECTED" or assessment.expires_at <= time.time()):
        verdict, reason = "DENY", "INVALID_OR_EXPIRED_EVIDENCE"
    elif not config.rules.get(body.target, False):
        # Manual lighting remains available even if its event automation is disabled.
        if assessment or body.target == "entry_lock":
            verdict, reason = "DENY", "RULE_DISABLED"
    if verdict == "ALLOW" and body.target == "entry_lock":
        verdict, reason = "HOLD", "OWNER_APPROVAL_REQUIRED"
    row = PhantomDecision(id=uid(), household_id=home.id, actor_id=actor.id,
        command_key=str(body.command_key), run_id=run_id, assessment_id=assessment.id if assessment else None,
        target=body.target, command=body.command, payload=payload, payload_digest=checksum,
        policy_revision=config.revision, home_revision=home.policy_revision, decision=verdict, reason=reason,
        latency_ms=0)
    db.add(row)
    db.flush()
    if verdict == "HOLD":
        valid_until = time.time()+120
        if assessment:
            trigger = db.get(PhantomEvent, assessment.trigger_id)
            valid_until = min(valid_until, assessment.expires_at,
                              (trigger.observed_at or 0)+config.window_seconds+30)
        db.add(PhantomApproval(household_id=home.id, command_id=row.id, requester_id=actor.id,
               session_id=session.id, payload_digest=checksum, policy_revision=config.revision,
               home_revision=home.policy_revision, expires_at=valid_until))
    elif verdict == "ALLOW":
        _execute(db, home, row)
    ingress_wait = 0
    if assessment:
        trigger = db.get(PhantomEvent, assessment.trigger_id)
        ingress_wait = max(0, entered_at - trigger.received_at)
    row.latency_ms = round(((time.perf_counter()-started) + ingress_wait)*1000, 3)
    audit(db, "phantom.decision", actor=actor.id, household=home.id, command_id=row.id,
          decision=verdict, reason=reason, policy_revision=config.revision)
    db.flush()
    return row


def confirm(db, home, config, actor, session, challenge_id, choice):
    now = time.time()
    grant = db.scalar(select(PhantomApproval).where(PhantomApproval.household_id == home.id,
                      PhantomApproval.id == challenge_id).with_for_update())
    if not grant:
        raise HTTPException(404, "Approval not found")
    if grant.requester_id != actor.id or grant.session_id != session.id:
        raise HTTPException(403, "Only the requesting owner/admin session may confirm this action")
    household_access(db, home.id, actor.id, write=True)
    current_session = db.scalar(select(SessionRecord).where(SessionRecord.id == grant.session_id)
                               .with_for_update().execution_options(populate_existing=True))
    if not current_session or current_session.user_id != actor.id or current_session.expires_at <= now:
        raise HTTPException(403, "Requesting session is no longer valid")
    row = db.scalar(select(PhantomDecision).where(PhantomDecision.household_id == home.id,
                    PhantomDecision.id == grant.command_id))
    if grant.consumed_at:
        if grant.outcome != choice:
            raise HTTPException(409, "Approval was already consumed")
        return row  # Idempotent acknowledgement, never a second execution.
    reason = None
    if grant.expires_at <= now:
        reason = "APPROVAL_EXPIRED"
    elif grant.policy_revision != config.revision or grant.home_revision != home.policy_revision:
        reason = "POLICY_REVISION_CHANGED"
    elif row.actor_id != actor.id or row.payload_digest != grant.payload_digest or binding(home.id, actor.id, row.target, row.command, row.payload) != grant.payload_digest:
        reason = "ACTION_BINDING_CHANGED"
    elif row.decision != "HOLD" or row.executed_at is not None:
        reason = "COMMAND_NOT_PENDING"
    elif not config.rules.get(row.target, False):
        reason = "RULE_DISABLED"
    elif choice == "approve" and (not current_session.authenticated_at or current_session.authenticated_at < now-600):
        reason = "RECENT_LOGIN_REQUIRED"
    if not reason and row.assessment_id and choice == "approve":
        original = db.get(PhantomAssessment, row.assessment_id)
        trigger = db.get(PhantomEvent, original.trigger_id)
        fresh = assess(db, home, trigger, config, now=now)
        # Owner confirmation can resolve uncertainty, but never replay rejection
        # or stale evidence. Save the new assessment as part of the audit trail.
        if original.expires_at <= now or fresh.state == "REJECTED" or "EVIDENCE_EXPIRED" in fresh.evidence['reason_codes']:
            reason = "INVALID_OR_EXPIRED_EVIDENCE"
        audit(db, "phantom.approval_review", actor=actor.id, household=home.id,
              command_id=row.id, assessment_id=fresh.id, state=fresh.state)
    grant.consumed_at, grant.approver_id = now, actor.id
    if reason:
        grant.outcome, row.decision, row.reason = "invalidated", "DENY", reason
    elif choice == "reject":
        grant.outcome, row.decision, row.reason = choice, "DENY", "OWNER_REJECTED"
    else:
        grant.outcome, row.decision, row.reason = choice, "ALLOW", "EXACT_ACTION_OWNER_APPROVAL"
        db.flush()
        _execute(db, home, row)
    audit(db, "phantom.approval", actor=actor.id, household=home.id, command_id=row.id,
          outcome=grant.outcome, reason=row.reason)
    db.flush()
    return row


def reset_fixture(db, home, config, actor):
    """Fixed simulator lifecycle operation; cannot unlock or issue hardware commands."""
    for grant in db.scalars(select(PhantomApproval).where(PhantomApproval.household_id == home.id,
                            PhantomApproval.consumed_at == None)):
        grant.consumed_at, grant.outcome = time.time(), "reset"
        decision = db.get(PhantomDecision, grant.command_id)
        decision.decision, decision.reason = "DENY", "FIXTURE_RESET"
    for target, command in (("hallway_light", "turn_off"), ("entry_lock", "reset_fixture")):
        row = PhantomDecision(household_id=home.id, actor_id=actor.id, command_key=uid(),
            target=target, command=command, payload={}, payload_digest=binding(home.id, actor.id, target, command, {}),
            policy_revision=config.revision, home_revision=home.policy_revision,
            decision="ALLOW", reason="FIXTURE_INITIALIZATION", latency_ms=0)
        db.add(row); db.flush(); _execute(db, home, row)
    config.revision += 1
