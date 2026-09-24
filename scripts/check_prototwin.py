"""
Tenure — Live ProtoTwin UR5e Real-Time Telemetry Monitor

Connects directly to your running ProtoTwin simulation on port 8084.
Reads the actual 6 UR5e joint signals in real time without mocks.

Signal Addresses from your ProtoTwin model:
  Signal  0: Simulation Time (seconds)
  Signal  1: ur5e_robot_controller_error
  Signal  6: J1 (link_1_motor_current_position)
  Signal 13: J2 (link_2_motor_current_position)
  Signal 20: J3 (link_3_motor_current_position)
  Signal 27: J4 (link_4_motor_current_position)
  Signal 34: J5 (link_5_motor_current_position)
  Signal 41: J6 (link_6_motor_current_position)
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


async def stream_live_ur5e(port: int = 8084, rate_hz: float = 5.0):
    interval = 1.0 / rate_hz
    print("=" * 110)
    print(f"  TENURE -> PROTOTWIN LIVE TELEMETRY MONITOR (Port: {port})")
    print("=" * 110)
    print("  Direct memory mapping from ProtoTwin Connect:")
    print("    Signal 00: Simulation Time (s) [Matches GUI timer at bottom-right]")
    for j, addr in JOINT_ADDRESSES.items():
        print(f"    Signal {addr:02d}: {j} Current Position")
    print("=" * 110)

    while True:
        ws = None
        try:
            print(f"\n[CONNECTING] Connecting to ws://localhost:{port}...")
            ws = await connect(
                f"ws://localhost:{port}",
                compression=None,
                user_agent_header="Python",
                ping_interval=None,
                close_timeout=5,
            )
            # Await handshake ready frame from ProtoTwin
            await ws.recv()
            client = Client(ws)
            await client.sync()
            print("[CONNECTED] Link established! Reading raw ProtoTwin memory buffers in real time.\n")
            print(f"{'WALL CLOCK':<10} | {'SIM TIME':<10} | {'SIM STATE':<8} | {'J1 (Base)':<12} | {'J2 (Shoulder)':<12} | {'J3 (Elbow)':<12} | {'J4 (Wrist 1)':<12} | {'J5 (Wrist 2)':<12} | {'J6 (Wrist 3)':<12}")
            print("-" * 115)

            last_sim_time = None
            while True:
                await client.sync()
                wall_time = time.strftime("%H:%M:%S")

                sim_time = client.get(0)
                sim_time_val = float(sim_time) if isinstance(sim_time, (int, float)) else 0.0

                # Detect if simulation is actively running or paused in GUI
                if last_sim_time is not None:
                    is_running = abs(sim_time_val - last_sim_time) > 0.0001
                    state_str = "RUNNING" if is_running else "PAUSED"
                else:
                    state_str = "--"
                last_sim_time = sim_time_val

                cols = []
                for j in ["J1", "J2", "J3", "J4", "J5", "J6"]:
                    addr = JOINT_ADDRESSES[j]
                    val = client.get(addr)
                    rad = float(val) if isinstance(val, (int, float)) else 0.0
                    deg = math.degrees(rad)
                    cols.append(f"{deg:>6.1f}°")

                line = f"{wall_time:<10} | {sim_time_val:>8.2f}s | {state_str:<8} | " + " | ".join(cols)
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
