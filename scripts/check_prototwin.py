"""
Tenure — Live ProtoTwin UR5e Real-Time Joint Reader

Connects directly to the running ProtoTwin simulation via the ProtoTwin Python API.
Reads all six UR5e joint positions in real time and prints them continuously.
Handles connection errors gracefully.

Signal Addresses from ProtoTwin UR5e model:
  J1 = 6  (link_1_motor_current_position)
  J2 = 13 (link_2_motor_current_position)
  J3 = 20 (link_3_motor_current_position)
  J4 = 27 (link_4_motor_current_position)
  J5 = 34 (link_5_motor_current_position)
  J6 = 41 (link_6_motor_current_position)
"""

import asyncio
import math
import sys
import time

try:
    import prototwin
except ImportError:
    print("[ERROR] 'prototwin' package is not installed in this environment.")
    print("Please run: .venv\\Scripts\\pip.exe install prototwin")
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
    print("=" * 70)
    print(f"  CONNECTING TO LIVE PROTOTWIN SIMULATION (Port: {port})...")
    print("=" * 70)
    print("Signal Addresses:")
    for j, addr in JOINT_ADDRESSES.items():
        print(f"  {j} Position -> Signal {addr}")
    print("-" * 70)

    client = None
    try:
        client = await prototwin.attach(port=port)
        await client.sync()
        print(f"[SUCCESS] Attached to live ProtoTwin session on port {port}!")
        print("Reading actual UR5e joint signals in real time (Press Ctrl+C to stop):\n")
        print(f"{'TIME':<12} | {'J1 (rad)':<10} | {'J2 (rad)':<10} | {'J3 (rad)':<10} | {'J4 (rad)':<10} | {'J5 (rad)':<10} | {'J6 (rad)':<10}")
        print("-" * 82)

        while True:
            # Synchronize latest frame from ProtoTwin
            await client.sync()

            t_str = time.strftime("%H:%M:%S")
            positions = {}
            for j, addr in JOINT_ADDRESSES.items():
                val = client.get(addr)
                positions[j] = float(val) if isinstance(val, (int, float)) else 0.0

            line = f"{t_str:<12} | {positions['J1']:>9.4f} | {positions['J2']:>9.4f} | {positions['J3']:>9.4f} | {positions['J4']:>9.4f} | {positions['J5']:>9.4f} | {positions['J6']:>9.4f}"
            print(line)

            await asyncio.sleep(interval)

    except KeyboardInterrupt:
        print("\n\n[INFO] Stopped streaming by user (Ctrl+C).")
    except ConnectionRefusedError:
        print(f"\n[ERROR] Connection refused on port {port}.")
        print("Please ensure ProtoTwin is running on your PC with ProtoTwin Connect enabled on port 8084.")
    except Exception as e:
        print(f"\n[ERROR] Unexpected ProtoTwin connection error: {e}")
        print("Please verify the ProtoTwin application is open and listening.")
    finally:
        if client and hasattr(client, "_ws") and client._ws:
            try:
                await client._ws.close()
                print("[INFO] Connection closed gracefully.")
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(stream_live_ur5e())
