"""
Tenure — Live ProtoTwin UR5e Real-Time Telemetry Monitor

Connects directly to your running ProtoTwin simulation on port 8084.
Reads the actual 6 UR5e joint signals in real time without mocks.

Signal Addresses from your ProtoTwin model:
  J1 = 6  (link_1_motor_current_position)
  J2 = 13 (link_2_motor_current_position)
  J3 = 20 (link_3_motor_current_position)
  J4 = 27 (link_4_motor_current_position)
  J5 = 34 (link_5_motor_current_position)
  J6 = 41 (link_6_motor_current_position)

Features:
  - Disables websocket ping timeout (keeps connection alive indefinitely)
  - Displays both degrees and radians for easy visual cross-check with 3D model
  - Auto-reconnects gracefully if ProtoTwin restarts
"""

import asyncio
import math
import sys
import time

try:
    from websockets.legacy.client import connect
    from prototwin.client import Client
except ImportError:
    print("[ERROR] Required packages not found. Run: .venv\\Scripts\\pip.exe install prototwin websockets")
    sys.exit(1)


JOINT_ADDRESSES = {
    "J1": 6,
    "J2": 13,
    "J3": 20,
    "J4": 27,
    "J5": 34,
    "J6": 41,
}

VELOCITY_ADDRESSES = {
    "J1": 7,
    "J2": 14,
    "J3": 21,
    "J4": 28,
    "J5": 35,
    "J6": 42,
}

FORCE_ADDRESSES = {
    "J1": 8,
    "J2": 15,
    "J3": 22,
    "J4": 29,
    "J5": 36,
    "J6": 43,
}


async def stream_live_ur5e(port: int = 8084, rate_hz: float = 10.0):
    interval = 1.0 / rate_hz
    print("=" * 80)
    print(f"  TENURE -> PROTOTWIN LIVE TELEMETRY STREAM (Port: {port})")
    print("=" * 80)
    print("  Signal mapping:")
    for j, addr in JOINT_ADDRESSES.items():
        print(f"    {j} Position -> Signal Address {addr}")
    print("=" * 80)

    while True:
        ws = None
        try:
            print(f"\n[CONNECTING] Establishing persistent link to ws://localhost:{port}...")
            ws = await connect(
                f"ws://localhost:{port}",
                compression=None,
                user_agent_header="Python",
                ping_interval=None,  # Native ProtoTwin C++ engine doesn't respond to WS ping frames
                close_timeout=5,
            )
            # Await handshake ready frame
            await ws.recv()
            client = Client(ws)
            await client.sync()
            print("[CONNECTED] Real-time telemetry streaming active! Press Ctrl+C to stop.\n")
            print(f"{'TIME':<8} | {'J1 (Base)':<15} | {'J2 (Shoulder)':<15} | {'J3 (Elbow)':<15} | {'J4 (Wrist 1)':<15} | {'J5 (Wrist 2)':<15} | {'J6 (Wrist 3)':<15}")
            print("-" * 105)

            last_values = {}
            while True:
                await client.sync()
                t_str = time.strftime("%H:%M:%S")

                readings = {}
                for j, addr in JOINT_ADDRESSES.items():
                    val = client.get(addr)
                    rad = float(val) if isinstance(val, (int, float)) else 0.0
                    deg = math.degrees(rad)
                    readings[j] = (rad, deg)

                # Format columns with degrees and radians
                cols = []
                for j in ["J1", "J2", "J3", "J4", "J5", "J6"]:
                    rad, deg = readings[j]
                    cols.append(f"{deg:>6.1f}° ({rad:>5.2f}r)")

                line = f"{t_str:<8} | " + " | ".join(cols)
                print(line)

                await asyncio.sleep(interval)

        except KeyboardInterrupt:
            print("\n\n[STOPPED] Monitoring stopped by user (Ctrl+C).")
            if ws:
                try:
                    await ws.close()
                except Exception:
                    pass
            break
        except (ConnectionRefusedError, OSError) as e:
            print(f"[RETRY] Could not reach ProtoTwin on port {port} ({e}). Retrying in 2 seconds...")
            await asyncio.sleep(2.0)
        except Exception as e:
            print(f"\n[RECONNECT] Stream interrupted: {e}. Reconnecting in 1.5 seconds...")
            if ws:
                try:
                    await ws.close()
                except Exception:
                    pass
            await asyncio.sleep(1.5)


if __name__ == "__main__":
    asyncio.run(stream_live_ur5e())
