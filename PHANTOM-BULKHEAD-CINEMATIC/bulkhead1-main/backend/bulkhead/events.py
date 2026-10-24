import asyncio
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException
from sqlalchemy import select
from .config import settings
from .db import DB, SessionLocal, Household, Membership, EventRecord
from .security import CurrentUser, household_access, session_for
from .service import snapshot

router = APIRouter(tags=["events"])


@router.get("/api/v1/households/{household_id}/events")
def replay(household_id: str, db: DB, user: CurrentUser, after: int = 0):
    home, _ = household_access(db, household_id, user.id)
    if after < 0 or after > home.sequence:
        raise HTTPException(400, "Invalid event cursor")
    return [{"sequence": e.sequence, "type": e.kind, "payload": e.payload}
            for e in db.scalars(select(EventRecord).where(EventRecord.household_id == home.id, EventRecord.sequence > after)
                                .order_by(EventRecord.sequence).limit(200))]


def socket_batch(websocket, household_id, cursor, initial):
    # This short transaction is independent of delivery. No subscriber registry exists.
    with SessionLocal.begin() as db:
        session = session_for(db, websocket)
        if not session or not session.user_id:
            return None
        member = db.scalar(select(Membership).where(Membership.household_id == household_id, Membership.user_id == session.user_id))
        if not member or (member.expires_at and member.expires_at <= time.time()):
            return None
        home = db.get(Household, household_id)
        if not home:
            return None
        if initial or cursor > home.sequence:
            # Snapshot and cursor share the household lock to avoid a mixed revision.
            home = db.scalar(select(Household).where(Household.id == household_id).with_for_update())
            return [{"sequence": home.sequence, "type": "STATE_UPDATE", "payload": snapshot(db, home)}]
        return [{"sequence": e.sequence, "type": e.kind, "payload": e.payload}
                for e in db.scalars(select(EventRecord).where(EventRecord.household_id == home.id, EventRecord.sequence > cursor)
                                    .order_by(EventRecord.sequence).limit(100))]


@router.websocket("/api/v1/households/{household_id}/events/ws")
async def stream(websocket: WebSocket, household_id: str):
    if websocket.headers.get("origin") != settings().origin:
        await websocket.close(code=4403)
        return
    try:
        raw = websocket.query_params.get("after")
        cursor = int(raw) if raw is not None else 0
        if cursor < 0:
            raise ValueError()
    except ValueError:
        await websocket.close(code=4400)
        return
    try:
        batch = await asyncio.to_thread(socket_batch, websocket, household_id, cursor, raw is None)
        if batch is None:
            await websocket.close(code=4401)
            return
        await websocket.accept()
        while True:
            if batch is None:
                await websocket.close(code=4403)
                break
            for message in batch:
                await asyncio.wait_for(websocket.send_json(message), timeout=5)
                cursor = message["sequence"]
            await asyncio.wait_for(websocket.send_json({"type": "HEARTBEAT", "sequence": cursor}), timeout=5)
            try:
                # Detect close promptly; every loop also rechecks session/membership expiry.
                message = await asyncio.wait_for(websocket.receive(), timeout=0.75)
                if message["type"] == "websocket.disconnect":
                    break
            except asyncio.TimeoutError:
                pass
            batch = await asyncio.to_thread(socket_batch, websocket, household_id, cursor, False)
    except (WebSocketDisconnect, RuntimeError, OSError, asyncio.TimeoutError):
        pass
