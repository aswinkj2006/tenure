import sys as _sys, os as _os
_sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(_sys.stdout, 'reconfigure') else None

"""
Tenure — ProtoTwin Real-Time WebSocket Bridge
============================================
Supports both:
  1. Headless mode (no ProtoTwin GUI needed):
     Launches ProtoTwin Connect via prototwin.start(), loads your .ptm model,
     calls client.initialize(), steps physics with client.step(), and broadcasts.
  2. GUI Attach mode:
     Attaches to an actively running ProtoTwin Desktop Editor instance on ws://localhost:8084
     in READ-ONLY mode (no client.step(), preventing double-stepping).

In both modes, it:
  - Broadcasts live joint & gripper telemetry over WebSocket (ws://localhost:8765)
  - Pushes telemetry into Tenure's Anomaly Service (http://localhost:8001/sensors/ingest)

Usage:
  # Headless mode (runs your .ptm physics engine directly):
  python scripts/prototwin_bridge.py --mode headless --model "C:\\Users\\Aswin K J\\Documents\\ur5e.ptm"

  # GUI Attach mode (attaches to already open ProtoTwin GUI):
  python scripts/prototwin_bridge.py --mode attach --hz 20
"""

import argparse
import asyncio
import json
import os
import time
from datetime import datetime, timezone

import httpx
import websockets

# Default model path found on system
DEFAULT_MODEL_PATH = os.path.expanduser(r"~\Documents\ur5e.ptm")

# ─────────────────────────────────────────────────────────────
# UR5e Signal Addresses (from ProtoTwin I/O Window)
# ─────────────────────────────────────────────────────────────
JOINT_POSITION_ADDRS = {
    "joint_1_position": 6,
    "joint_2_position": 13,
    "joint_3_position": 20,
    "joint_4_position": 27,
    "joint_5_position": 34,
    "joint_6_position": 41,
}

JOINT_VELOCITY_ADDRS = {
    "joint_1_velocity": 7,
    "joint_2_velocity": 14,
    "joint_3_velocity": 21,
    "joint_4_velocity": 28,
    "joint_5_velocity": 35,
    "joint_6_velocity": 42,
}

JOINT_TORQUE_ADDRS = {
    "joint_1_torque": 8,
    "joint_2_torque": 15,
    "joint_3_torque": 22,
    "joint_4_torque": 29,
    "joint_5_torque": 36,
    "joint_6_torque": 43,
}

GRIPPER_ADDRS = {
    "gripper_enable": 44,    # 1.0 when gripper attached
    "gripper_position": 45,  # 0.0 = open, 1.0 = closed
}

ALL_SIGNAL_ADDRS = {
    **JOINT_POSITION_ADDRS,
    **JOINT_VELOCITY_ADDRS,
    **JOINT_TORQUE_ADDRS,
    **GRIPPER_ADDRS,
}

WEBSOCKET_PORT = 8765
INGEST_URL = "http://localhost:8001/sensors/ingest"
PROTOTWIN_GUI_WS = "ws://localhost:8084"

connected_clients = set()


async def register_ws(websocket):
    """Track each browser tab or UI client connected to ws://localhost:8765."""
    connected_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)


async def broadcast_ws(data: dict):
    """Broadcast real-time sensor readings to all connected WebSocket clients."""
    if not connected_clients:
        return
    message = json.dumps(data)
    await asyncio.gather(
        *(ws.send(message) for ws in connected_clients),
        return_exceptions=True,
    )


def extract_sensors(client) -> dict:
    """Read all registered signals from ProtoTwin client."""
    readings = {}
    for name, addr in ALL_SIGNAL_ADDRS.items():
        try:
            val = client.get(addr)
            readings[name] = float(val) if isinstance(val, (int, float, bool)) else 0.0
        except Exception:
            readings[name] = 0.0
    return readings


async def run_headless_loop(client, step_hz: int = 60, push_tenure: bool = True):
    """Headless simulation loop: steps physics, reads signals, and broadcasts."""
    dt = 1.0 / step_hz
    step_count = 0
    print(f"[headless] Physics loop active at {step_hz} Hz...")

    async with httpx.AsyncClient(timeout=1.0) as http:
        while True:
            t0 = time.monotonic()

            readings = extract_sensors(client)

            # Broadcast over local WebSocket (ws://localhost:8765)
            await broadcast_ws(readings)

            # Forward to Tenure Anomaly Service (every 3rd step if 60Hz -> 20Hz ingest)
            if push_tenure and (step_count % max(1, step_hz // 20) == 0):
                payload = {
                    "machine_id": "ur5e-001",
                    "sensors": readings,
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
                try:
                    await http.post(INGEST_URL, json=payload)
                except Exception:
                    pass

            await client.step()
            step_count += 1

            if step_count % (step_hz * 5) == 0:
                j_pos = [round(readings.get(f"joint_{i}_position", 0), 2) for i in range(1, 7)]
                grip = readings.get("gripper_position", 0)
                print(f"[headless] Step {step_count:6d} | Joints={j_pos} | Gripper={grip:.2f}")

            elapsed = time.monotonic() - t0
            await asyncio.sleep(max(0, dt - elapsed))


async def run_gui_attach_loop(client, hz: int = 20, push_tenure: bool = True):
    """GUI Attach loop: reads signals from running ProtoTwin GUI (no step())."""
    interval = 1.0 / hz
    frame_count = 0
    print(f"[attach] Reading live ProtoTwin GUI telemetry at {hz} Hz (no step())...")

    async with httpx.AsyncClient(timeout=1.0) as http:
        while True:
            t0 = time.monotonic()

            readings = extract_sensors(client)

            # Broadcast over local WebSocket
            await broadcast_ws(readings)

            # Forward to Tenure Anomaly Service
            if push_tenure:
                payload = {
                    "machine_id": "ur5e-001",
                    "sensors": readings,
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
                try:
                    await http.post(INGEST_URL, json=payload)
                except Exception:
                    pass

            frame_count += 1
            if frame_count % (hz * 5) == 0:
                j_pos = [round(readings.get(f"joint_{i}_position", 0), 2) for i in range(1, 7)]
                grip = readings.get("gripper_position", 0)
                print(f"[attach] Frame {frame_count:6d} | Joints={j_pos} | Gripper={grip:.2f}")

            elapsed = time.monotonic() - t0
            await asyncio.sleep(max(0, interval - elapsed))


async def main():
    parser = argparse.ArgumentParser(description="ProtoTwin -> Tenure WebSocket Bridge")
    parser.add_argument("--mode", choices=["headless", "attach", "auto"], default="auto",
                        help="Operation mode: headless (run .ptm), attach (ProtoTwin GUI), auto")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL_PATH,
                        help="Path to .ptm model file for headless mode")
    parser.add_argument("--hz", type=int, default=60,
                        help="Simulation step rate for headless (default: 60) or polling rate for attach")
    parser.add_argument("--port", type=int, default=WEBSOCKET_PORT,
                        help="WebSocket broadcast port (default: 8765)")
    args = parser.parse_args()

    mode = args.mode

    # Auto-detection: try GUI attach first, otherwise headless
    if mode == "auto":
        print("[bridge] Auto-detecting ProtoTwin environment...")
        try:
            from websockets.legacy.client import connect as ws_connect
            ws_test = await ws_connect(PROTOTWIN_GUI_WS, timeout=1.5, ping_interval=None)
            await ws_test.close()
            mode = "attach"
            print("[bridge] Detected active ProtoTwin GUI on port 8084. Selecting 'attach' mode.")
        except Exception:
            mode = "headless"
            print(f"[bridge] ProtoTwin GUI not detected. Selecting 'headless' mode with {args.model}.")

    print("=" * 65)
    print(f"  Tenure ProtoTwin WebSocket Bridge [{mode.upper()} MODE]")
    print("=" * 65)

    client = None

    if mode == "headless":
        import prototwin
        if not os.path.exists(args.model):
            print(f"[bridge] ERROR: Model file not found at {args.model}")
            print("Please specify --model <path_to_your_model.ptm>")
            return

        print(f"[bridge] Launching ProtoTwin Connect engine...")
        client = await prototwin.start()
        print(f"[bridge] Loading model: {args.model}")
        await client.load(args.model)
        print("[bridge] Initializing signal subscriptions...")
        await client.initialize()
        print("[bridge] Model initialized successfully!")

    elif mode == "attach":
        from websockets.legacy.client import connect as ws_connect
        from prototwin.client import Client as ProtoClient

        print(f"[bridge] Connecting to ProtoTwin GUI at {PROTOTWIN_GUI_WS}...")
        ws = await ws_connect(
            PROTOTWIN_GUI_WS,
            compression=None,
            user_agent_header="Tenure-Bridge",
            ping_interval=None,
            close_timeout=5,
        )
        await ws.recv()
        client = ProtoClient(ws)
        await client.initialize()
        print("[bridge] Connected and initialized with ProtoTwin GUI!")

    # Start WebSocket server for web clients
    async with websockets.serve(register_ws, "0.0.0.0", args.port):
        print(f"[bridge] WebSocket broadcast server running at ws://localhost:{args.port}")
        print(f"[bridge] Ingestion forwarder targeting {INGEST_URL}")

        if mode == "headless":
            await run_headless_loop(client, step_hz=args.hz, push_tenure=True)
        else:
            await run_gui_attach_loop(client, hz=min(args.hz, 30), push_tenure=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[bridge] Bridge stopped by user.")
