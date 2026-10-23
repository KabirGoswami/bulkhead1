from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from .db import DB, Incident, Action
from .security import CurrentUser, household_access
from .service import incident_view, action_view, load_state, changed, execute_simulation, restore_simulation

router = APIRouter(prefix="/api/v1/households/{household_id}", tags=["incidents"])


@router.get("/incidents")
def incidents(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    state = load_state(db, home)
    return [incident_view(i, state, home.profile) for i in db.scalars(select(Incident).where(Incident.household_id == home.id).order_by(Incident.created_at.desc()).limit(100))]


class StatusInput(BaseModel):
    status: Literal["acknowledged", "resolved", "open"]


@router.patch("/incidents/{incident_id}")
def status(household_id: str, incident_id: str, body: StatusInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    incident = db.scalar(select(Incident).where(Incident.household_id == home.id, Incident.id == incident_id))
    if not incident:
        raise HTTPException(404, "Incident not found")
    incident.status = body.status
    changed(db, home, "incident." + body.status, actor=user.id, incident_id=incident.id)
    return incident_view(incident, load_state(db, home), home.profile)


class ActionInput(BaseModel):
    incident_id: str
    action: Literal["CONTAIN", "REVOKE"]
    command_id: str = Field(min_length=16, max_length=64)
    policy_revision: int


@router.post("/actions", status_code=201)
def confirm(household_id: str, body: ActionInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    incident = db.scalar(select(Incident).where(Incident.household_id == home.id, Incident.id == body.incident_id))
    if not incident:
        raise HTTPException(404, "Current incident not found")
    return action_view(execute_simulation(db, home, incident, body.action, user.id, body.command_id, body.policy_revision))


@router.get("/actions")
def actions(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    return [action_view(a) for a in db.scalars(select(Action).where(Action.household_id == home.id).order_by(Action.created_at.desc()).limit(200))]


@router.post("/actions/{action_id}/undo")
def undo(household_id: str, action_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    action = db.scalar(select(Action).where(Action.household_id == home.id, Action.id == action_id))
    if not action:
        raise HTTPException(404, "Action not found")
    return action_view(restore_simulation(db, home, action, user.id))
