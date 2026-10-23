import time
from fastapi import APIRouter, HTTPException, Request
import httpx
from sqlalchemy import select
from .db import DB, DeviceRecord, AdvisoryCache, Job
from .security import CurrentUser, household_access, digest, throttle

router = APIRouter(prefix="/api/v1/households/{household_id}/integrations", tags=["integrations"])


@router.get("/advisories/{device_id}")
async def advisories(household_id: str, device_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id)
    device = db.scalar(select(DeviceRecord).where(DeviceRecord.household_id == home.id, DeviceRecord.id == device_id))
    if not device:
        raise HTTPException(404, "Device not found")
    cpe, firmware = device.data.get("product_cpe"), device.data.get("firmware_version")
    if not cpe or not firmware or len(cpe.split(":")) != 13 or cpe.split(":")[5] != firmware or firmware in ("*", "-"):
        return {"status": "unknown", "reason": "An exact product CPE and firmware version are required", "advisories": []}
    key = digest(cpe)
    cached = db.get(AdvisoryCache, key)
    if cached and cached.expires_at > time.time():
        return {**cached.data, "cached": True, "expires_at": cached.expires_at}
    from .config import settings
    cfg = settings()
    headers = {"apiKey": cfg.nvd_api_key} if cfg.nvd_api_key else {}
    if not cfg.nvd_api_key:
        throttle(db, "nvd", 4, 30)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get("https://services.nvd.nist.gov/rest/json/cves/2.0",
                                        params={"cpeName": cpe, "isVulnerable": "", "resultsPerPage": 100},
                                        headers=headers)
            response.raise_for_status()
            data = response.json()
            advisories = [{"id": v["cve"]["id"], "url": "https://nvd.nist.gov/vuln/detail/"+v["cve"]["id"],
                           "description": next((d["value"] for d in v["cve"].get("descriptions", []) if d["lang"] == "en"), "")}
                          for v in data.get("vulnerabilities", [])]
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, "Advisory service unavailable; device security remains unknown")
    value = {"status": "matched" if advisories else "unknown", "advisories": advisories, "product_cpe": cpe,
             "fetched_at": time.time(), "total_results": data.get("totalResults", 0),
             "note": "No matching advisory is not evidence of safety. Results are product/version matches, not an exploit test."}
    # Cache upsert avoids a race between concurrent lookups.
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    insert = sqlite_insert if db.bind.dialect.name == "sqlite" else pg_insert
    stmt = insert(AdvisoryCache).values(id=key, data=value, expires_at=time.time()+86400)
    db.execute(stmt.on_conflict_do_update(index_elements=[AdvisoryCache.id], set_={"data": value, "expires_at": time.time()+86400}))
    return {**value, "cached": False}


@router.get("/notifications")
def notifications(household_id: str, db: DB, user: CurrentUser):
    home, _ = household_access(db, household_id, user.id, write=True)
    return [{"id": j.id, "state": j.state, "attempts": j.attempts, "error": j.error}
            for j in db.scalars(select(Job).where(Job.household_id == home.id, Job.kind == "email").order_by(Job.available_at.desc()).limit(100))]
