"""API entry point. The root index.html is the independent Driftbar footer."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from bulkhead import auth, households, inventory, policies, incidents, integrations, events, gateway
from bulkhead.db import DB
from bulkhead.service import worker_status
from bulkhead.phantom.router import router as phantom_router

app = FastAPI(title="Bulkhead", version="1.0.0", docs_url=None, redoc_url=None, openapi_url="/api/v1/openapi.json")
for module in (auth, households, inventory, policies, incidents, integrations, events, gateway):
    app.include_router(module.router)
app.include_router(phantom_router)


@app.middleware("http")
async def response_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.exception_handler(IntegrityError)
async def conflict(_request, _exc):
    return JSONResponse(status_code=409, content={"detail": "Concurrent or duplicate operation; refresh and retry"})


@app.exception_handler(OperationalError)
async def unavailable(_request, _exc):
    return JSONResponse(status_code=503, content={"detail": "Database temporarily unavailable; retry shortly"})


@app.get("/api/v1/health")
def health(db: DB):
    db.execute(text("SELECT 1"))
    worker = worker_status(db)
    return JSONResponse(status_code=200 if worker["healthy"] else 503,
                        content={"api": "healthy", "database": "healthy", "worker": worker})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, proxy_headers=False, reload=True)
