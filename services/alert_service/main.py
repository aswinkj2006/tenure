"""
Tenure — Alert Service

FastAPI server that:
  1. Manages alert lifecycle (open -> acknowledged -> resolved)
  2. Broadcasts alerts over WebSocket to connected frontend clients at /ws/alerts/{machine_id}
  3. Executes safety actions (e.g. emergency stop/slowdown signals) for critical/high severity alerts

Port: 8002
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.init_db import get_connection


# ──────────────────────────────────────────────────────────
# Data models
# ──────────────────────────────────────────────────────────

class AlertCreateRequest(BaseModel):
    anomaly_id: str
    machine_id: str
    severity: str  # low, medium, high, critical
    flagged_sensors: list[str]
    deviation_magnitude: dict[str, float]
    message: str = ""
    ts: str | None = None


# ──────────────────────────────────────────────────────────
# Global state
# ──────────────────────────────────────────────────────────

# Active WebSocket subscribers per machine_id
alert_subscribers: dict[str, list[WebSocket]] = {}

# Active alerts cache
active_alerts: dict[str, dict[str, Any]] = {}


app = FastAPI(
    title="Tenure Alert Service",
    description="Severity tiering, alert lifecycle, and real-time alert dispatching.",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────
# WebSocket endpoint
# ──────────────────────────────────────────────────────────

@app.websocket("/ws/alerts/{machine_id}")
async def ws_alerts(websocket: WebSocket, machine_id: str):
    """
    WebSocket endpoint that pushes real-time anomaly alerts to the frontend.
    """
    await websocket.accept()

    if machine_id not in alert_subscribers:
        alert_subscribers[machine_id] = []
    alert_subscribers[machine_id].append(websocket)

    print(f"[alert_service] WebSocket subscriber connected for {machine_id}")

    try:
        # Keep connection open
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        alert_subscribers[machine_id].remove(websocket)
        print(f"[alert_service] WebSocket subscriber disconnected for {machine_id}")


# ──────────────────────────────────────────────────────────
# REST endpoints
# ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "alert_service"}


@app.post("/alerts")
async def create_alert(payload: AlertCreateRequest):
    """
    Trigger a new alert from the anomaly detection engine.
    Dispatches to WebSocket subscribers and executes automatic safety tier actions.
    """
    alert_id = str(uuid.uuid4())
    ts = payload.ts or datetime.now(timezone.utc).isoformat()

    alert_obj = {
        "id": alert_id,
        "anomaly_id": payload.anomaly_id,
        "machine_id": payload.machine_id,
        "severity": payload.severity,
        "flagged_sensors": payload.flagged_sensors,
        "deviation_magnitude": payload.deviation_magnitude,
        "message": payload.message or f"Anomaly flagged on {', '.join(payload.flagged_sensors)}",
        "status": "open",
        "ts": ts,
    }

    active_alerts[alert_id] = alert_obj

    # 1. Automatic safety tier actions
    safety_action = None
    if payload.severity in ("critical", "high"):
        safety_action = "EMERGENCY_STOP_TRIGGERED" if payload.severity == "critical" else "RATE_LIMIT_SLOWDOWN"
        print(f"[alert_service] [ALERT] {payload.severity.upper()} alert on {payload.machine_id}: Executing {safety_action}")
        alert_obj["safety_action"] = safety_action

    # 2. Broadcast via WebSocket
    machine_id = payload.machine_id
    if machine_id in alert_subscribers:
        msg_str = json.dumps({"type": "NEW_ALERT", "alert": alert_obj})
        disconnected = []
        for ws in alert_subscribers[machine_id]:
            try:
                await ws.send_text(msg_str)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            alert_subscribers[machine_id].remove(ws)

    return {"status": "created", "alert": alert_obj}


@app.get("/alerts/{machine_id}")
async def list_alerts(machine_id: str, limit: int = 50):
    """
    List alerts for a given machine, both from active memory and database.
    """
    alerts = [a for a in active_alerts.values() if a["machine_id"] == machine_id]
    
    # Also fetch historical from anomaly_records table
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, machine_id, ts, flagged_sensors, deviation_magnitude, severity, status
            FROM anomaly_records
            WHERE machine_id = ?
            ORDER BY ts DESC
            LIMIT ?
            """,
            (machine_id, limit),
        )
        rows = cursor.fetchall()

    db_alerts = []
    for r in rows:
        db_alerts.append({
            "id": r[0],
            "machine_id": r[1],
            "ts": r[2],
            "flagged_sensors": json.loads(r[3]) if r[3] else [],
            "deviation_magnitude": json.loads(r[4]) if r[4] else {},
            "severity": r[5],
            "status": r[6],
        })

    return {"machine_id": machine_id, "active": alerts, "history": db_alerts}


@app.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Mark an alert as acknowledged by a technician."""
    if alert_id in active_alerts:
        active_alerts[alert_id]["status"] = "acknowledged"
        return {"status": "acknowledged", "alert_id": alert_id}

    return {"status": "acknowledged", "alert_id": alert_id}


@app.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Mark an alert as resolved in DB and cache."""
    if alert_id in active_alerts:
        active_alerts[alert_id]["status"] = "resolved"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE anomaly_records SET status = 'resolved' WHERE id = ?", (alert_id,))
        conn.commit()

    return {"status": "resolved", "alert_id": alert_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.alert_service.main:app", host="0.0.0.0", port=8002, reload=True)
