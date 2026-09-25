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
from pydantic import BaseModel

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

# Timestamp of latest live ingestion from ProtoTwin
last_real_ingest_time: float = 0.0

# Stream health tracking
stream_is_alive: bool = False
stream_restart_count: int = 0

class TelemetryIngestPayload(BaseModel):
    machine_id: str = "ur5e-001"
    sensors: dict[str, float]
    ts: str | None = None



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

    # Start the background sensor streaming watchdog (auto-restarts on crash)
    _sensor_task = asyncio.create_task(_stream_watchdog())
    print("[anomaly_service] Sensor stream watchdog started.")

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

async def _stream_watchdog():
    """Watchdog that keeps _sensor_stream_loop alive, restarting it on any crash."""
    global stream_restart_count, stream_is_alive
    while True:
        try:
            stream_is_alive = True
            print(f"[anomaly_service] Starting sensor stream (attempt #{stream_restart_count + 1})")
            await _sensor_stream_loop()
        except asyncio.CancelledError:
            stream_is_alive = False
            print("[anomaly_service] Stream watchdog cancelled.")
            raise
        except Exception as exc:
            stream_is_alive = False
            stream_restart_count += 1
            print(f"[anomaly_service] Stream crashed ({exc}), restarting in 2s... (restart #{stream_restart_count})")
            await asyncio.sleep(2)


async def _sensor_stream_loop():
    """Continuously read sensors, detect anomalies, record events, and broadcast."""
    global sim_client, latest_readings, stream_is_alive

    if not sim_client:
        await asyncio.sleep(1)
        return

    async for reading in sim_client.stream_sensors():
        stream_is_alive = True
        # If live telemetry just arrived from ProtoTwin (within last 1.5s), skip mock data
        if time.time() - last_real_ingest_time < 1.5:
            await asyncio.sleep(0.1)
            continue

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
    return {
        "status": "ok",
        "service": "anomaly_service",
        "stream_alive": stream_is_alive,
        "stream_restarts": stream_restart_count,
        "data_age_seconds": round(time.time() - last_real_ingest_time, 1) if last_real_ingest_time > 0 else None,
    }


@app.get("/stream/status")
async def stream_status():
    """Detailed stream health check."""
    machine_id = "ur5e-001"
    has_data = machine_id in latest_readings
    last_ts = latest_readings[machine_id].get("ts") if has_data else None
    return {
        "stream_alive": stream_is_alive,
        "stream_restarts": stream_restart_count,
        "has_latest_data": has_data,
        "last_timestamp": last_ts,
        "live_ingest_age_seconds": round(time.time() - last_real_ingest_time, 1) if last_real_ingest_time > 0 else None,
        "sim_client_type": type(sim_client).__name__ if sim_client else None,
        "subscribers": {k: len(v) for k, v in sensor_subscribers.items()},
    }


@app.post("/sensors/ingest")
async def ingest_sensor_reading(payload: TelemetryIngestPayload):
    """
    Direct live telemetry ingestion from ProtoTwin simulator (browser or desktop).
    Streams exact physics values to the 3D Digital Twin and runs real-time anomaly detection.
    """
    global latest_readings, sensor_history, last_real_ingest_time
    last_real_ingest_time = time.time()
    machine_id = payload.machine_id
    ts = payload.ts or datetime.now(timezone.utc).isoformat()

    data: dict[str, Any] = {
        "ts": ts,
        "machine_id": machine_id,
        "sensors": payload.sensors,
    }

    # Evaluate zero-shot anomaly detection
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
        if (now_sec - last_flagged) > 3.0:
            last_flagged_time[machine_id] = now_sec
            anomaly_id = str(uuid.uuid4())
            data["anomaly"]["anomaly_id"] = anomaly_id
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
            asyncio.create_task(_dispatch_alert(anomaly_id, machine_id, anomaly_eval, ts))
    else:
        data["anomaly"] = {"is_anomaly": False}

    # Store latest and append history
    latest_readings[machine_id] = data
    if machine_id not in sensor_history:
        sensor_history[machine_id] = []
    sensor_history[machine_id].append(data)
    if len(sensor_history[machine_id]) > HISTORY_SIZE:
        sensor_history[machine_id].pop(0)

    # Broadcast to all connected digital twin WebSockets
    if machine_id in sensor_subscribers:
        msg = json.dumps(data)
        disconnected = []
        for ws in sensor_subscribers[machine_id]:
            try:
                await ws.send_text(msg)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            sensor_subscribers[machine_id].remove(ws)

    return {"status": "ok", "anomaly": data["anomaly"]["is_anomaly"]}


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



class InjectAnomalyRequest(BaseModel):
    scenario: str = "torque_spike"
    joint: int = 3
    value: float = 185.0
    anomaly_type: str = "torque"


class GradualDegradationRequest(BaseModel):
    joint: int = 3
    rate: float = 3.5


@app.post("/simulate-gradual-degradation")
async def simulate_gradual_degradation(req: GradualDegradationRequest):
    """
    Simulate a slowly rising condition in that robot leading to complete breakdown.
    Ramps torque on the target joint until critical safety threshold is breached.
    """
    if not sim_client:
        raise HTTPException(status_code=400, detail="Simulation client not connected")

    if hasattr(sim_client, "start_gradual_degradation"):
        sim_client.start_gradual_degradation(joint=req.joint, rate_per_sec=req.rate)
        return {
            "status": "degradation_started",
            "joint": req.joint,
            "rate": req.rate,
            "message": f"Simulating gradual harmonic drive wear on Joint {req.joint}. Torque drifting upward...",
        }
    else:
        # Fallback to direct injection if using real ProtoTwin client
        return await inject_anomaly(InjectAnomalyRequest(joint=req.joint, value=148.0, anomaly_type="torque"))


@app.post("/emergency-stop")
async def emergency_stop():
    """Manually engage emergency safety stop."""
    if not sim_client:
        raise HTTPException(status_code=400, detail="Simulation client not connected")

    if hasattr(sim_client, "trigger_emergency_stop"):
        sim_client.trigger_emergency_stop()

    return {"status": "stopped", "message": "EMERGENCY SAFETY STOP ENGAGED. Arm halted."}


@app.post("/reset-safety-stop")
async def reset_safety_stop():
    """Clear emergency stop and resume normal machine operation."""
    if not sim_client:
        raise HTTPException(status_code=400, detail="Simulation client not connected")

    if hasattr(sim_client, "reset_emergency_stop"):
        sim_client.reset_emergency_stop()

    return {"status": "resumed", "message": "Emergency safety stop cleared. Pick-and-place resumed."}


@app.post("/inject-anomaly")
async def inject_anomaly(
    joint: int | None = None,
    value: float | None = None,
    anomaly_type: str | None = None,
    req: InjectAnomalyRequest | None = None,
):
    """
    Inject an anomaly into the live simulation (real ProtoTwin or mock).
    Accepts both JSON body and query parameters for full compatibility.
    """
    if not sim_client:
        raise HTTPException(status_code=400, detail="Simulation client not connected")

    act_joint = (req.joint if req else None) if (joint is None and req) else (joint if joint is not None else 3)
    act_type = (req.anomaly_type if req else None) if (anomaly_type is None and req) else (anomaly_type or "torque")
    act_value = (req.value if req else None) if (value is None and req) else (value if value is not None else 185.0)

    if isinstance(sim_client, MockProtoTwinClient):
        sim_client.inject_anomaly(joint=act_joint, anomaly_type=act_type, magnitude=act_value)
    elif isinstance(sim_client, ProtoTwinClient):
        from sim.inject_anomaly import get_signal_address
        try:
            addr = get_signal_address(act_joint, act_type)
            sim_client.write_signal(addr, act_value)
            await sim_client.step()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed writing to ProtoTwin signal: {e}")

    return {
        "status": "injected",
        "joint": act_joint,
        "type": act_type,
        "value": act_value,
        "message": f"Anomaly injected: joint_{act_joint}_{act_type} = {act_value}",
    }


@app.post("/clear-anomaly")
async def clear_anomaly():
    """Clear any injected anomaly and reset safety stops."""
    if not sim_client:
        raise HTTPException(status_code=400, detail="Simulation client not connected")

    if hasattr(sim_client, "clear_anomaly"):
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
