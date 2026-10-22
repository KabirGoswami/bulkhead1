from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import json
import os
import asyncio

from models import HomeState, Device, Account, AuditFinding
from audit import run_audit, apply_fix
from blast import calculate_exposure_score_fixed, get_reachable_nodes
from simulator import HomeSimulator
from baseline import BaselineEngine
from detector import DetectorEngine
from policy import PolicyEngine
from profiles import PROFILES

app = FastAPI(title="Bulkhead API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-Memory State ---
# Load seed data
with open("backend/seed_home.json", "r") as f:
    seed_devices = json.load(f)
with open("backend/accounts.json", "r") as f:
    seed_accounts = json.load(f)

current_state = HomeState(
    devices=[Device(**d) for d in seed_devices],
    accounts=[Account(**a) for a in seed_accounts]
)

# WebSocket connections
connections: List[WebSocket] = []
simulator = None # Initialize in startup
baseline_engine = None
detector_engine = None
policy_engine = None
current_profile = "Admin"

async def broadcast(message: Dict[str, Any]):
    for connection in connections:
        await connection.send_json(message)

@app.on_event("startup")
async def startup_event():
    global simulator, baseline_engine, detector_engine, policy_engine
    simulator = HomeSimulator(current_state)
    baseline_engine = BaselineEngine()
    detector_engine = DetectorEngine(baseline_engine)
    policy_engine = PolicyEngine()
    # Start simulation loop
    asyncio.create_task(simulation_loop())

async def simulation_loop():
    while True:
        events = await simulator.run_tick()

        # Process events through baseline and detector
        alerts = []
        for event in events:
            # Update baseline
            baseline_engine.process_event(event)
            # Check for anomalies
            alert = detector_engine.analyze_event(event)
            if alert:
                # Apply Policy with Profile Overrides
                response = policy_engine.determine_response(alert, current_state)

                # Profile-based autonomy override
                profile = PROFILES.get(current_profile, PROFILES["Admin"])
                if profile.autonomy_overrides:
                    device = next((d for d in current_state.devices if d.id == alert.node_id), None)
                    if device and device.criticality in profile.autonomy_overrides:
                        response["level"] = profile.autonomy_overrides[device.criticality]
                        response["can_auto_act"] = (response["level"] == 1)
                        response["requires_confirmation"] = (response["level"] == 2)

                # Level 1: Auto-act
                if response["can_auto_act"]:
                    policy_engine.execute_action(alert, "CONTAIN", current_state)
                    alert_data = alert.dict()
                    alert_data["action_taken"] = "CONTAINED"
                    alerts.append(alert_data)
                else:
                    alert_data = alert.dict()
                    alert_data["response"] = response
                    alerts.append(alert_data)

        # Broadcast events and alerts to clients
        await broadcast({
            "type": "SIM_TICK",
            "payload": {
                "events": [e.dict() for e in events],
                "alerts": alerts,
                "tick": simulator.tick_count
            }
        })
        await asyncio.sleep(1) # 1 real second = 1 simulated minute

@app.get("/state")
async def get_state():
    return {
        "devices": [d.dict() for d in current_state.devices],
        "accounts": [a.dict() for a in current_state.accounts],
        "exposure_score": calculate_exposure_score_fixed(current_state)
    }

@app.get("/audit")
async def get_audit():
    findings = run_audit(current_state)
    return [f.dict() for f in findings]

@app.post("/audit/fix")
async def fix_finding(finding_id: str):
    findings = run_audit(current_state)
    finding = next((f for f in findings if f.id == finding_id), None)

    if not finding:
        return {"error": "Finding not found"}, 404

    global current_state
    current_state = apply_fix(current_state, finding)

    # Notify all clients via WS that state changed
    await broadcast({
        "type": "STATE_UPDATE",
        "payload": {
            "devices": [d.dict() for d in current_state.devices],
            "accounts": [a.dict() for a in current_state.accounts],
            "exposure_score": calculate_exposure_score_fixed(current_state)
        }
    })

    return {"status": "fixed"}

@app.get("/blast/{node_id}")
async def get_blast_radius(node_id: str):
    reachable = get_reachable_nodes(current_state, node_id)
    return {
        "reachable": list(reachable),
        "count": len(reachable)
    }

@app.post("/scenario/{scenario_id}")
async def trigger_scenario(scenario_id: str):
    if scenario_id not in ["A", "B", "C"]:
        return {"error": "Invalid scenario"}, 400

    global simulator
    simulator.set_scenario(scenario_id)

    return {"status": f"Scenario {scenario_id} started"}

@app.post("/scenario/reset")
async def reset_scenario():
    global simulator
    simulator.set_scenario(None)
    return {"status": "Scenario reset"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)
    try:
        # Send initial state
        await websocket.send_json({
            "type": "STATE_UPDATE",
            "payload": {
                "devices": [d.dict() for d in current_state.devices],
                "accounts": [a.dict() for a in current_state.accounts],
                "exposure_score": calculate_exposure_score_fixed(current_state)
            }
        })
        while True:
            await websocket.receive_text() # Keep connection alive
    except WebSocketDisconnect:
        connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
