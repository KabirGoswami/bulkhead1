import base64
import hashlib
import re
import secrets
import time
from urllib.parse import urlencode
import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, delete, update
from .config import settings
from .db import DB, User, Identity, SessionRecord, Token, Job, uid, SessionLocal
from .security import (CurrentUser, digest, password_hash, password_valid, session_for, new_session,
                       csrf_check, token_new, token_use, throttle, audit, COOKIE)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
DUMMY_HASH = password_hash(secrets.token_urlsafe(24))


class EmailInput(BaseModel):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def normalize(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email")
        return value


class Credentials(EmailInput):
    password: str = Field(min_length=12, max_length=1024)


class TokenInput(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class ResetInput(TokenInput):
    password: str = Field(min_length=12, max_length=1024)


def queue_mail(db, recipient, subject, text, key, household_id=None):
    if not db.scalar(select(Job.id).where(Job.dedupe_key == key)):
        db.add(Job(kind="email", dedupe_key=key, household_id=household_id,
                   payload={"recipient": recipient, "subject": subject, "text": text}))


def email_token(db, user, purpose):
    raw = token_new(db, purpose, user.id, ttl=3600 if purpose == "recovery" else 86400)
    route = "recover" if purpose == "recovery" else "verify"
    queue_mail(db, user.email, f"Bulkhead: {purpose}",
               f"Open {settings().origin}/#/{route}?token={raw}\nThis link expires and can be used once.",
               f"{purpose}:{digest(raw)}")


def auth_throttle(db, request, email=""):
    # Ignore forwarded headers; only the same-origin proxy can reach the API in Compose.
    ip = request.client.host if request.client else "unknown"
    throttle(db, f"auth-ip:{ip}", 60)
    if email:
        throttle(db, f"auth-email:{email}", 10)


@router.get("/csrf")
def csrf(db: DB, request: Request, response: Response):
    session = session_for(db, request)
    value = secrets.token_urlsafe(32)
    if session:
        session.csrf_hash = digest(value)
    else:
        value = new_session(db, response)
    response.headers["Cache-Control"] = "no-store"
    return {"csrf_token": value}


@router.get("/me")
def me(db: DB, user: CurrentUser, request: Request):
    session = session_for(db, request)
    return {"id": user.id, "email": user.email, "verified": user.verified,
            "session_id": session.id, "google_configured": bool(settings().google_client_id and settings().google_client_secret),
            "google_linked": bool(db.scalar(select(Identity.id).where(Identity.user_id == user.id, Identity.provider == "google")))}


@router.get("/options")
def options():
    return {"google_configured": bool(settings().google_client_id and settings().google_client_secret)}


@router.post("/register", status_code=202)
def register(body: Credentials, db: DB, request: Request):
    csrf_check(db, request)
    auth_throttle(db, request, body.email)
    if not db.scalar(select(User).where(User.email == body.email)):
        user = User(email=body.email, password_hash=password_hash(body.password))
        db.add(user)
        db.flush()
        email_token(db, user, "verification")
        audit(db, "auth.registered", actor=user.id)
    return {"message": "If this address is eligible, a verification email has been queued."}


@router.post("/verify")
def verify(body: TokenInput, db: DB, request: Request):
    csrf_check(db, request)
    auth_throttle(db, request)
    token = token_use(db, body.token, "verification")
    user = db.get(User, token.user_id)
    user.verified = True
    audit(db, "auth.email_verified", actor=user.id)
    return {"message": "Email verified. You can now sign in."}


@router.post("/verification", status_code=202)
def resend(body: EmailInput, db: DB, request: Request):
    csrf_check(db, request)
    auth_throttle(db, request, body.email)
    user = db.scalar(select(User).where(User.email == body.email))
    if user and not user.verified:
        email_token(db, user, "verification")
    return {"message": "If verification is needed, an email has been queued."}


@router.post("/login")
def login(body: Credentials, db: DB, request: Request, response: Response):
    old = csrf_check(db, request)
    auth_throttle(db, request, body.email)
    user = db.scalar(select(User).where(User.email == body.email))
    valid = password_valid(body.password, user.password_hash if user and user.password_hash else DUMMY_HASH)
    if not valid or not user or not user.verified:
        raise HTTPException(401, "Invalid credentials or email not verified")
    csrf = new_session(db, response, user.id, old)
    audit(db, "auth.login", actor=user.id)
    return {"id": user.id, "email": user.email, "csrf_token": csrf}


@router.post("/logout")
def logout(db: DB, user: CurrentUser, request: Request, response: Response):
    db.delete(session_for(db, request))
    response.delete_cookie(COOKIE, path="/", secure=settings().secure_cookie, httponly=True, samesite="lax")
    audit(db, "auth.logout", actor=user.id)
    return {"message": "Signed out"}


@router.get("/sessions")
def sessions(db: DB, user: CurrentUser):
    return [{"id": s.id, "expires_at": s.expires_at, "authenticated_at": s.authenticated_at}
            for s in db.scalars(select(SessionRecord).where(SessionRecord.user_id == user.id, SessionRecord.expires_at > time.time()))]


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: str, db: DB, user: CurrentUser):
    session = db.scalar(select(SessionRecord).where(SessionRecord.id == session_id, SessionRecord.user_id == user.id))
    if not session:
        raise HTTPException(404, "Session not found")
    db.delete(session)
    audit(db, "auth.session_revoked", actor=user.id)
    return {"message": "Session revoked"}


@router.post("/recovery", status_code=202)
def recovery(body: EmailInput, db: DB, request: Request):
    csrf_check(db, request)
    auth_throttle(db, request, body.email)
    user = db.scalar(select(User).where(User.email == body.email))
    if user:
        email_token(db, user, "recovery")
    return {"message": "If this address is registered, recovery instructions have been queued."}


@router.post("/reset")
def reset(body: ResetInput, db: DB, request: Request):
    csrf_check(db, request)
    auth_throttle(db, request)
    token = token_use(db, body.token, "recovery")
    user = db.get(User, token.user_id)
    user.password_hash = password_hash(body.password)
    user.verified = True
    db.execute(delete(SessionRecord).where(SessionRecord.user_id == user.id))
    db.execute(update(Token).where(Token.user_id == user.id, Token.purpose == "recovery").values(used=True))
    audit(db, "auth.password_recovered", actor=user.id)
    return {"message": "Password changed; all signed-in sessions have been revoked."}


def google_authorization(db, request, response, link_user=None):
    cfg = settings()
    if not cfg.google_client_id or not cfg.google_client_secret:
        raise HTTPException(503, "Google sign-in requires server credentials")
    session = session_for(db, request)
    if not session:
        new_session(db, response)
        db.flush()
        raw_cookie = response.headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]
        session = db.get(SessionRecord, digest(raw_cookie))
    verifier, nonce = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    state = token_new(db, "google", link_user.id if link_user else None, ttl=600,
                      session_id=session.id, verifier=verifier, nonce=nonce, link=bool(link_user))
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
        "client_id": cfg.google_client_id, "redirect_uri": cfg.callback, "response_type": "code",
        "scope": "openid email profile", "state": state, "nonce": nonce,
        "code_challenge": challenge, "code_challenge_method": "S256", "prompt": "select_account"})


@router.get("/google/start")
def google_start(db: DB, request: Request):
    auth_throttle(db, request)
    response = RedirectResponse("/", status_code=303)
    response.headers["location"] = google_authorization(db, request, response)
    return response


@router.post("/google/link")
def google_link(db: DB, user: CurrentUser, request: Request, response: Response):
    session = session_for(db, request)
    if not session.authenticated_at or session.authenticated_at < time.time() - 600:
        raise HTTPException(403, "Sign in again before linking an identity")
    return {"url": google_authorization(db, request, response, user)}


async def validate_google(code, token_data):
    cfg = settings()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": cfg.google_client_id, "client_secret": cfg.google_client_secret,
            "redirect_uri": cfg.callback, "grant_type": "authorization_code", "code_verifier": token_data["verifier"]})
        response.raise_for_status()
        encoded = response.json()["id_token"]
        # Fixed trusted endpoint; never follow a token-controlled jku or issuer URL.
        keys = await client.get("https://www.googleapis.com/oauth2/v3/certs")
        keys.raise_for_status()
        header = jwt.get_unverified_header(encoded)
        if header.get("alg") != "RS256":
            raise ValueError("Invalid signing algorithm")
        key = next((k for k in keys.json()["keys"] if k.get("kid") == header.get("kid")), None)
        if not key:
            raise ValueError("Unknown signing key")
        claims = jwt.decode(encoded, jwt.PyJWK.from_dict(key).key, algorithms=["RS256"],
                            audience=cfg.google_client_id, issuer=["https://accounts.google.com", "accounts.google.com"],
                            options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce", "email", "email_verified"]})
        if not secrets.compare_digest(str(claims["nonce"]), token_data["nonce"]) or claims["email_verified"] is not True:
            raise ValueError("Invalid nonce or unverified email")
        if claims.get("azp", cfg.google_client_id) != cfg.google_client_id:
            raise ValueError("Invalid authorized party")
        return claims


@router.get("/google/callback")
async def google_callback(state: str, db: DB, request: Request, code: str = "", error: str = ""):
    auth_throttle(db, request)
    session = session_for(db, request)
    # Consume callback state in a separate transaction even when code/JWT validation
    # fails. State is single-use and browser-bound on every outcome.
    with SessionLocal.begin() as token_db:
        token = token_use(token_db, state, "google")
        if not session or session.id != token.data["session_id"]:
            raise HTTPException(400, "Google state is not bound to this browser")
        token_data, token_user_id = dict(token.data), token.user_id
    if not session:
        raise HTTPException(400, "Google session expired")
    if error or not code:
        raise HTTPException(400, "Google authentication was cancelled")
    try:
        claims = await validate_google(code, token_data)
    except (httpx.HTTPError, jwt.PyJWTError, ValueError, KeyError, StopIteration):
        raise HTTPException(400, "Google identity validation failed")
    identity = db.scalar(select(Identity).where(Identity.provider == "google", Identity.subject == claims["sub"]))
    if token_data["link"]:
        if session.user_id != token_user_id or not session.authenticated_at or session.authenticated_at < time.time()-1200:
            raise HTTPException(403, "Authenticated confirmation required for linking")
        if identity and identity.user_id != token_user_id:
            raise HTTPException(409, "Google identity already belongs to another user")
        user = db.get(User, token_user_id)
    elif identity:
        user = db.get(User, identity.user_id)
    else:
        email = EmailInput(email=claims["email"]).email
        if db.scalar(select(User).where(User.email == email)):
            # Matching email alone is never account-linking consent.
            raise HTTPException(409, "Sign in to your existing account and confirm Google linking in Household settings")
        user = User(email=email, verified=True)
        db.add(user)
        db.flush()
    if not identity:
        db.add(Identity(provider="google", subject=claims["sub"], user_id=user.id))
    response = RedirectResponse("/#/household" if token_data["link"] else "/#/network", status_code=303)
    new_session(db, response, user.id, session)
    audit(db, "auth.google_linked" if token_data["link"] else "auth.google_login", actor=user.id)
    return response
