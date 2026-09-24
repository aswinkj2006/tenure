"""
Tenure — Anomaly Service

FastAPI server that:
  1. Runs the ProtoTwin simulation (or mock) and streams sensor data
  2. Exposes WebSocket at /ws/sensors/{machine_id} for the frontend
  3. Runs zero-shot anomaly detection on the sensor stream (Phase 2)
  4. Writes anomaly_records to the database when deviations are flagged

Port: 8001
"""

import asyncio
import json
import os
import sys
import time

import uuid
from contextlib import asynccontextmanager

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sim.client import MockProtoTwinClient, ProtoTwinClient, SensorReading
from db.init_db import get_connection, init_db

from services.anomaly_service.detector import AnomalyDetector
import httpx


# ──────────────────────────────────────────────────────────
# Global state
# ──────────────────────────────────────────────────────────

# Active WebSocket connections per machine_id
sensor_subscribers: dict[str, list[WebSocket]] = {}

# The sim client (shared across the app)
sim_client: MockProtoTwinClient | None = None

# Detector instance
detector = AnomalyDetector(window_size=60, z_threshold=3.5)

# Debounce tracker so we don't spam 10 DB records per second during continuous anomaly
last_flagged_time: dict[str, float] = {}

# Latest sensor readings (for REST fallback)
latest_readings: dict[str, dict[str, float]] = {}

# Sensor history for sparklines (last N readings per machine)
HISTORY_SIZE = 60
sensor_history: dict[str, list[dict[str, Any]]] = {}

# Background task handle
_sensor_task: asyncio.Task | None = None



# ──────────────────────────────────────────────────────────
# Lifespan
# ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global sim_client, _sensor_task

    # Initialize DB
    init_db()
    print("[anomaly_service] Database initialized.")

    # Check if real ProtoTwin is active or requested
    use_mock = os.getenv("USE_MOCK_SIM", "false").lower() == "true" or "pytest" in sys.modules
    sim_client = None

    if not use_mock:
        try:
            real_client = ProtoTwinClient(machine_id="ur5e-001")
            await real_client.connect()
            if real_client._running:
                sim_client = real_client
                print("[anomaly_service] Connected to LIVE ProtoTwin simulation model!")
        except Exception as e:
            print(f"[anomaly_service] Could not connect to live ProtoTwin: {e}")

    # Fallback to mock if ProtoTwin is not connected
    if sim_client is None:
        sim_client = MockProtoTwinClient(machine_id="ur5e-001", step_interval=0.1)
        await sim_client.connect()
        print("[anomaly_service] Using synthetic Mock ProtoTwin client.")


    # Start the background sensor streaming task
    _sensor_task = asyncio.create_task(_sensor_stream_loop())
    print("[anomaly_service] Sensor streaming started.")

    yield


    # Shutdown
    if _sensor_task:
        _sensor_task.cancel()
    if sim_client:
        await sim_client.disconnect()
    print("[anomaly_service] Shutdown complete.")


app = FastAPI(
    title="Tenure Anomaly Service",
    description="Streams sensor data from UR5e simulation and detects anomalies.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for frontend and digital twin web UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────
# Background: sensor streaming loop
# ──────────────────────────────────────────────────────────

async def _sensor_stream_loop():
    """Continuously read sensors, detect anomalies, record events, and broadcast."""
    global sim_client, latest_readings

    if not sim_client:
        return

    async for reading in sim_client.stream_sensors():
        machine_id = reading.machine_id
        data = reading.to_dict()

        # 1. Evaluate zero-shot anomaly detection
        anomaly_eval = detector.evaluate(data)
        if anomaly_eval.is_anomaly:
            data["anomaly"] = {
                "is_anomaly": True,
                "flagged": anomaly_eval.flagged_sensors,
                "severity": anomaly_eval.severity,
                "deviation": anomaly_eval.deviation_magnitude,
            }

            now_sec = time.time()
            last_flagged = last_flagged_time.get(machine_id, 0.0)

            # Debounce DB inserts (once every 3 seconds per machine unless severity rises)
            if (now_sec - last_flagged) > 3.0:
                last_flagged_time[machine_id] = now_sec
                anomaly_id = str(uuid.uuid4())
                ts = data["ts"]

                # Write to anomaly_records table
                try:
                    with get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute(
                            """
                            INSERT INTO anomaly_records
                            (id, machine_id, ts, flagged_sensors, deviation_magnitude, severity, status)
                            VALUES (?, ?, ?, ?, ?, ?, 'open')
                            """,
                            (
                                anomaly_id,
                                machine_id,
                                ts,
                                json.dumps(anomaly_eval.flagged_sensors),
                                json.dumps(anomaly_eval.deviation_magnitude),
                                anomaly_eval.severity,
                            ),
                        )
                        conn.commit()
                        print(f"[anomaly_service] [ANOMALY] Recorded anomaly {anomaly_id} ({anomaly_eval.severity}) for {machine_id}")
                except Exception as e:
                    print(f"[anomaly_service] Failed to persist anomaly: {e}")

                # Notify alert_service asynchronously
                asyncio.create_task(_dispatch_alert(anomaly_id, machine_id, anomaly_eval, ts))
        else:
            data["anomaly"] = {"is_anomaly": False}

        # Store latest
        latest_readings[machine_id] = data

        # Append to history
        if machine_id not in sensor_history:
            sensor_history[machine_id] = []
        sensor_history[machine_id].append(data)
        if len(sensor_history[machine_id]) > HISTORY_SIZE:
            sensor_history[machine_id].pop(0)

        # Broadcast to WebSocket subscribers
        if machine_id in sensor_subscribers:
            message = json.dumps(data)
            disconnected = []
            for ws in sensor_subscribers[machine_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected.append(ws)

            # Clean up disconnected clients
            for ws in disconnected:
                sensor_subscribers[machine_id].remove(ws)


async def _dispatch_alert(anomaly_id: str, machine_id: str, anomaly_eval, ts: str):
    """Send alert notification payload to alert_service (port 8002)."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                "http://localhost:8002/alerts",
                json={
                    "anomaly_id": anomaly_id,
                    "machine_id": machine_id,
                    "severity": anomaly_eval.severity,
                    "flagged_sensors": anomaly_eval.flagged_sensors,
                    "deviation_magnitude": anomaly_eval.deviation_magnitude,
                    "ts": ts,
                },
            )
    except Exception:
        # Alert service might not be running simultaneously in standalone mode
        pass



# ──────────────────────────────────────────────────────────
# WebSocket: sensor stream
# ──────────────────────────────────────────────────────────

@app.websocket("/ws/sensors/{machine_id}")
async def ws_sensors(websocket: WebSocket, machine_id: str):
    """
    WebSocket endpoint that streams live sensor data for a machine.
    Pushes a JSON payload every ~100ms with all sensor values.
    """
    await websocket.accept()

    # Register subscriber
    if machine_id not in sensor_subscribers:
        sensor_subscribers[machine_id] = []
    sensor_subscribers[machine_id].append(websocket)

    print(f"[ws] Sensor subscriber connected for {machine_id}")

    try:
        # Keep connection alive — listen for any incoming messages
        while True:
            # Client can send commands (e.g., change sampling rate)
            data = await websocket.receive_text()
            # For now, ignore incoming messages
    except WebSocketDisconnect:
        sensor_subscribers[machine_id].remove(websocket)
        print(f"[ws] Sensor subscriber disconnected for {machine_id}")


# ──────────────────────────────────────────────────────────
# REST endpoints
# ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "anomaly_service"}


@app.get("/sensors/{machine_id}/latest")
async def get_latest_sensors(machine_id: str):
    """Get the latest sensor reading for a machine (REST fallback)."""
    if machine_id not in latest_readings:
        raise HTTPException(status_code=404, detail=f"No data for machine {machine_id}")
    return latest_readings[machine_id]


@app.get("/sensors/{machine_id}/history")
async def get_sensor_history(machine_id: str, limit: int = 30):
    """Get recent sensor history for sparkline charts."""
    if machine_id not in sensor_history:
        raise HTTPException(status_code=404, detail=f"No data for machine {machine_id}")
    history = sensor_history[machine_id][-limit:]
    return {"machine_id": machine_id, "readings": history, "count": len(history)}


@app.get("/anomalies/{machine_id}")
async def get_anomalies(machine_id: str, limit: int = 20):
    """Get flagged anomalies from the database for a machine."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, machine_id, ts, flagged_sensors, deviation_magnitude, severity, status, created_at
            FROM anomaly_records
            WHERE machine_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (machine_id, limit),
        )
        rows = cursor.fetchall()

    results = []
    for r in rows:
        results.append({
            "id": r[0],
            "machine_id": r[1],
            "ts": r[2],
            "flagged_sensors": json.loads(r[3]) if r[3] else [],
            "deviation_magnitude": json.loads(r[4]) if r[4] else {},
            "severity": r[5],
            "status": r[6],
            "created_at": r[7],
        })
    return {"machine_id": machine_id, "anomalies": results, "count": len(results)}



@app.post("/inject-anomaly")
async def inject_anomaly(
    joint: int = 3,
    anomaly_type: str = "torque",
    value: float = 185.0,
):
    """
    Inject an anomaly into the live simulation (real ProtoTwin or mock).
    """
    if not sim_client:
        raise HTTPException(status_code=400, detail="Simulation client not connected")

    if isinstance(sim_client, MockProtoTwinClient):
        sim_client.inject_anomaly(joint=joint, anomaly_type=anomaly_type, magnitude=value)
    elif isinstance(sim_client, ProtoTwinClient):
        from sim.inject_anomaly import get_signal_address
        try:
            addr = get_signal_address(joint, anomaly_type)
            sim_client.write_signal(addr, value)
            await sim_client.step()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed writing to ProtoTwin signal: {e}")

    return {
        "status": "injected",
        "joint": joint,
        "type": anomaly_type,
        "value": value,
        "message": f"Anomaly injected: joint_{joint}_{anomaly_type} = {value}",
    }


@app.post("/clear-anomaly")
async def clear_anomaly():
    """Clear any injected anomaly."""
    if not sim_client:
        raise HTTPException(status_code=400, detail="Simulation client not connected")

    if isinstance(sim_client, MockProtoTwinClient):
        sim_client.clear_anomaly()

    return {"status": "cleared"}



# ──────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "services.anomaly_service.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        reload_dirs=[str(Path(__file__).parent.parent.parent)],
    )
