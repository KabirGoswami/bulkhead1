import time
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from .db import DB, Household, Membership, User, Token
from .security import CurrentUser, household_access, token_new, token_use, digest
from .auth import EmailInput, queue_mail
from .service import seed_household, changed, snapshot
from .config import settings

router = APIRouter(prefix="/api/v1/households", tags=["households"])


class HomeInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class InviteInput(EmailInput):
    role: Literal["Admin", "Viewer"] = "Viewer"
    guest: bool = False
    guest_hours: int = Field(default=24, ge=1, le=168)


class AcceptInput(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class RoleInput(BaseModel):
    role: Literal["Admin", "Viewer"]


class Preferences(BaseModel):
    email_notifications: bool


@router.get("")
def list_homes(db: DB, user: CurrentUser):
    pairs = db.execute(select(Household, Membership).join(Membership, Household.id == Membership.household_id)
                       .where(Membership.user_id == user.id,
                              or_(Membership.expires_at == None, Membership.expires_at > time.time())))
    return [{"id": h.id, "name": h.name, "role": m.role, "expires_at": m.expires_at} for h, m in pairs]


@router.post("", status_code=201)
def create_home(body: HomeInput, db: DB, user: CurrentUser):
    home = Household(name=body.name.strip())
    db.add(home)
    db.flush()
    db.add(Membership(household_id=home.id, user_id=user.id, role="Owner"))
    seed_household(db, home)
    changed(db, home, "household.created", actor=user.id)
    return {"id": home.id, "name": home.name, "role": "Owner"}


@router.post("/invitations/accept")
def accept_invite(body: AcceptInput, db: DB, user: CurrentUser):
    token = token_use(db, body.token, "invitation")
    if token.data["email"] != user.email:
        raise HTTPException(403, "Invitation belongs to another verified email")
    home = db.scalar(select(Household).where(Household.id == token.data["household_id"]).with_for_update())
    inviter = db.get(Membership, token.data["inviter_membership_id"])
    if not home or not inviter or (inviter.expires_at and inviter.expires_at <= time.time()) or inviter.role not in ("Owner", "Admin"):
        raise HTTPException(409, "Inviter no longer has access")
    if token.data["role"] == "Admin" and inviter.role != "Owner":
        raise HTTPException(409, "Only an owner may grant Admin access")
    if db.scalar(select(Membership).where(Membership.household_id == home.id, Membership.user_id == user.id)):
        raise HTTPException(409, "A membership already exists; ask an owner to update it")
    membership = Membership(household_id=home.id, user_id=user.id, role=token.data["role"],
                            expires_at=time.time()+token.data["guest_seconds"] if token.data["guest_seconds"] else None)
    db.add(membership)
    changed(db, home, "membership.joined", actor=user.id, role=membership.role)
    return {"id": home.id, "role": membership.role, "expires_at": membership.expires_at}


@router.get("/{household_id}")
def home_settings(household_id: str, db: DB, user: CurrentUser):
    home, own = household_access(db, household_id, user.id)
    members = db.scalars(select(Membership).where(Membership.household_id == home.id))
    return {"id": home.id, "name": home.name, "role": own.role, "preferences": home.preferences,
            "members": [{"id": m.id, "user_id": m.user_id, "email": db.get(User, m.user_id).email,
                         "role": m.role, "expires_at": m.expires_at} for m in members]}


@router.patch("/{household_id}/preferences")
def preferences(household_id: str, body: Preferences, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    home.preferences = body.model_dump()
    changed(db, home, "household.preferences", actor=user.id, preferences=home.preferences)
    return home.preferences


@router.post("/{household_id}/invitations", status_code=201)
def invite(household_id: str, body: InviteInput, db: DB, user: CurrentUser):
    home, own = household_access(db, household_id, user.id, write=True)
    if body.role == "Admin" and own.role != "Owner":
        raise HTTPException(403, "Only owners grant Admin access")
    raw = token_new(db, "invitation", ttl=7*86400, email=body.email, household_id=home.id,
                    role=body.role, guest_seconds=body.guest_hours*3600 if body.guest else None,
                    inviter_membership_id=own.id)
    url = settings().origin + "/#/household?invite=" + raw
    queue_mail(db, body.email, f"Invitation to {home.name}", f"Accept at {url}\nThis invitation expires in seven days.", f"invite:{digest(raw)}", home.id)
    changed(db, home, "membership.invited", actor=user.id, email=body.email, role=body.role, guest=body.guest)
    return {"invite_url": url, "role": body.role, "expires_in": 7*86400}


@router.patch("/{household_id}/members/{membership_id}")
def change_role(household_id: str, membership_id: str, body: RoleInput, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, owner=True)
    member = db.scalar(select(Membership).where(Membership.household_id == home.id, Membership.id == membership_id))
    if not member:
        raise HTTPException(404, "Membership not found")
    if member.role == "Owner":
        raise HTTPException(409, "Owner membership cannot be downgraded")
    member.role = body.role
    changed(db, home, "membership.role_changed", actor=user.id, membership_id=member.id, role=body.role)
    return {"role": member.role}


@router.delete("/{household_id}/members/{membership_id}")
def remove_member(household_id: str, membership_id: str, db: DB, user: CurrentUser):
    home, own = household_access(db, household_id, user.id, write=True)
    member = db.scalar(select(Membership).where(Membership.household_id == home.id, Membership.id == membership_id))
    if not member:
        raise HTTPException(404, "Membership not found")
    if member.role == "Owner" or (own.role != "Owner" and member.role == "Admin"):
        raise HTTPException(403, "An owner must manage Admin membership")
    db.delete(member)
    changed(db, home, "membership.removed", actor=user.id, membership_id=membership_id)
    return {"message": "Membership removed; event access is terminated on the next authorization check"}
