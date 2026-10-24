import hashlib
import secrets
import time
from datetime import datetime, timezone
from typing import Annotated
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from cryptography.exceptions import InvalidKey
from .config import settings
from .db import DB, SessionRecord, User, Membership, Household, Token, Throttle, AuditEvent

COOKIE = "bulkhead_session"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password):
    return Argon2id(salt=secrets.token_bytes(16), length=32, iterations=3, lanes=4, memory_cost=65536).derive_phc_encoded(password.encode())


def password_valid(password, encoded):
    try:
        Argon2id.verify_phc_encoded(password.encode(), encoded)
        return True
    except (InvalidKey, ValueError, TypeError):
        return False


def iso(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()


def session_for(db, request):
    raw = request.cookies.get(COOKIE, "")
    session = db.get(SessionRecord, digest(raw)) if raw else None
    return session if session and session.expires_at > time.time() else None


def new_session(db, response, user_id=None, old=None):
    if old:
        db.delete(old)
    raw, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    ttl = 86400 * 7 if user_id else 3600
    db.add(SessionRecord(id=digest(raw), user_id=user_id, csrf_hash=digest(csrf),
                         authenticated_at=time.time() if user_id else None, expires_at=time.time() + ttl))
    response.set_cookie(COOKIE, raw, max_age=ttl, httponly=True, secure=settings().secure_cookie,
                        samesite="lax", path="/")
    return csrf


def enforce_origin(request):
    if request.headers.get("origin") != settings().origin:
        raise HTTPException(403, "Invalid request origin")


def csrf_check(db, request):
    enforce_origin(request)
    session = session_for(db, request)
    supplied = request.headers.get("x-csrf-token", "")
    if not session or not secrets.compare_digest(session.csrf_hash, digest(supplied)):
        raise HTTPException(403, "CSRF validation failed")
    return session


def current_user(db: DB, request: Request):
    session = session_for(db, request)
    if not session or not session.user_id:
        raise HTTPException(401, "Sign in required")
    user = db.get(User, session.user_id)
    if not user or not user.verified:
        raise HTTPException(403, "Verify your email before continuing")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        csrf_check(db, request)
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def household_access(db, household_id, user_id, write=False, owner=False):
    statement = select(Household).where(Household.id == household_id)
    household = db.scalar(statement.with_for_update() if write or owner else statement.with_for_update(read=True))
    if not household:
        raise HTTPException(404, "Household not found")
    membership = db.scalar(select(Membership).where(Membership.household_id == household_id,
                            Membership.user_id == user_id))
    if not membership or (membership.expires_at and membership.expires_at <= time.time()):
        raise HTTPException(404, "Household not found")
    if (write and membership.role not in ("Owner", "Admin")) or (owner and membership.role != "Owner"):
        raise HTTPException(403, "This role cannot make that change")
    return household, membership


def audit(db, kind, actor=None, household=None, **data):
    db.add(AuditEvent(kind=kind, actor_id=actor, household_id=household, data=data))


def token_new(db, purpose, user_id=None, ttl=3600, **data):
    raw = secrets.token_urlsafe(32)
    db.add(Token(id=digest(raw), purpose=purpose, user_id=user_id, expires_at=time.time()+ttl, data=data))
    return raw


def token_use(db, raw, purpose):
    token = db.scalar(select(Token).where(Token.id == digest(raw)).with_for_update())
    if not token or token.used or token.purpose != purpose or token.expires_at <= time.time():
        raise HTTPException(400, "Token is invalid or expired")
    token.used = True
    return token


def throttle(db, key, limit=10, window=900):
    # PostgreSQL upsert makes this shared across API processes and workers.
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    bucket = int(time.time() // window)
    key = digest(f"{key}:{bucket}")
    insert = sqlite_insert if db.bind.dialect.name == "sqlite" else pg_insert
    statement = insert(Throttle).values(id=key, count=1, expires_at=(bucket+1)*window)
    from sqlalchemy.orm import Session
    # Independent transaction retains failed-login counts after the request rolls back.
    with Session(db.bind) as rate_db, rate_db.begin():
        count = rate_db.scalar(statement.on_conflict_do_update(index_elements=[Throttle.id],
                               set_={"count": Throttle.count + 1}).returning(Throttle.count))
    if count > limit:
        raise HTTPException(429, "Too many attempts; try again later", headers={"Retry-After": str(window)})
