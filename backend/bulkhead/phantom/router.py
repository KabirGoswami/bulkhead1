import time
from fastapi import APIRouter, Request, Query, HTTPException
from ..db import DB, PhantomConfig, PhantomAssessment, PhantomDecision
from ..security import CurrentUser, household_access, session_for, audit
from ..service import emit
from .schemas import CommandInput, ApprovalInput, RuleInput, PrivacyInput, DemoInput
from .ingress import write_home, fixture
from .commands import propose, confirm, reset_fixture
from .views import overview, assessment_view, decision_view, recent
from .demo import run_demo
from .maintenance import purge_metadata

router = APIRouter(prefix="/api/v1/households/{household_id}/phantom", tags=["phantom"])


def notify(db, home, actor, kind):
    audit(db, kind, actor=actor.id, household=home.id)
    db.flush()
    # Send only invalidation, not sensitive evidence, into the long-lived replay log.
    emit(db, home, "PHANTOM_UPDATE", {"phantom_household_id": home.id})


@router.get('/overview')
def get_overview(household_id: str, db: DB, user: CurrentUser, request: Request):
    home, _ = household_access(db, household_id, user.id)
    return overview(db, home, db.get(PhantomConfig, home.id), user, session_for(db, request))


@router.get('/assessments')
def assessments(household_id: str, db: DB, user: CurrentUser, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=10000)):
    home, _ = household_access(db, household_id, user.id)
    config = db.get(PhantomConfig, home.id)
    cutoff = time.time() - (config.retention_days if config else 7)*86400
    return [assessment_view(a) for a in recent(db, PhantomAssessment, home.id, limit, offset) if a.created_at >= cutoff]


@router.get('/decisions')
def decisions(household_id: str, db: DB, user: CurrentUser, request: Request,
              limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=10000)):
    home, _ = household_access(db, household_id, user.id)
    session = session_for(db, request)
    return [decision_view(db, d, user.id, session.id) for d in recent(db, PhantomDecision, home.id, limit, offset)]


@router.get('/rules')
def rules(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    config = db.get(PhantomConfig, home.id)
    return {"revision": config.revision if config else 1, "window_seconds": config.window_seconds if config else 10,
            "rules": config.rules if config else {"hallway_light": True, "entry_lock": True},
            "protected_requires_owner_approval": True}


@router.post('/rules')
def set_rule(household_id: str, body: RuleInput, db: DB, user: CurrentUser):
    home = write_home(db, household_id, user.id); config = fixture(db, home)
    if body.revision != config.revision:
        raise HTTPException(409, "Policy changed; refresh before saving")
    config.rules = {**config.rules, body.target: body.enabled}
    config.window_seconds = body.window_seconds
    config.revision += 1
    notify(db, home, user, 'phantom.rules_changed')
    return {"revision": config.revision, "rules": config.rules}


@router.post('/commands')
def commands(household_id: str, body: CommandInput, db: DB, user: CurrentUser, request: Request):
    home = write_home(db, household_id, user.id); config = fixture(db, home)
    session = session_for(db, request)
    row = propose(db, home, config, user, session, body)
    notify(db, home, user, 'phantom.command_requested')
    return decision_view(db, row, user.id, session.id)


@router.post('/approvals/{challenge_id}/decision')
def approval(household_id: str, challenge_id: str, body: ApprovalInput, db: DB, user: CurrentUser, request: Request):
    home = write_home(db, household_id, user.id); config = fixture(db, home)
    session = session_for(db, request)
    row = confirm(db, home, config, user, session, challenge_id, body.decision)
    notify(db, home, user, 'phantom.approval_decided')
    return decision_view(db, row, user.id, session.id)


@router.patch('/privacy')
def privacy(household_id: str, body: PrivacyInput, db: DB, user: CurrentUser):
    home = write_home(db, household_id, user.id); config = fixture(db, home)
    config.retention_days = body.retention_days
    purge_metadata(db, home, config)
    notify(db, home, user, 'phantom.privacy_changed')
    return {"retention_days": config.retention_days, "metadata_only": True}


@router.post('/demo/reset')
def reset(household_id: str, db: DB, user: CurrentUser):
    home = write_home(db, household_id, user.id); config = fixture(db, home)
    reset_fixture(db, home, config, user)
    notify(db, home, user, 'phantom.fixture_reset')
    return {"message": "Virtual fixture reset. Approvals invalidated; replay guards and audit history retained."}


@router.post('/demo/run')
def demo(household_id: str, body: DemoInput, db: DB, user: CurrentUser, request: Request):
    home = write_home(db, household_id, user.id); config = fixture(db, home)
    run = run_demo(db, home, config, user, session_for(db, request), body)
    purge_metadata(db, home, config)
    notify(db, home, user, 'phantom.demo_run')
    return {"id": run.id, "scenario": run.scenario, **run.result}
