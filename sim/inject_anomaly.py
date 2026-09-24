"""
Tenure — Anomaly Injection Tool for UR5e Simulation

Manually triggers an anomaly by forcing out-of-range values on a specified joint.

Execution Modes (automatic):
  1. Live Service Mode: If `start_services.py` (or anomaly_service) is running on port 8001,
     it calls the live REST API directly. This immediately triggers live WebSocket alerts.
  2. Mock Standalone Mode: If no server is running, runs a standalone synthetic stream demo.
  3. Real ProtoTwin Mode: Pass `--real` to write directly to a running ProtoTwin instance.

Usage:
  # Predefined scenario (injects into running service if up, otherwise runs mock):
  .venv\\Scripts\\python.exe sim/inject_anomaly.py --scenario torque_spike

  # Custom values:
  .venv\\Scripts\\python.exe sim/inject_anomaly.py --joint 3 --type torque --value 188.0

  # Clear active anomaly:
  .venv\\Scripts\\python.exe sim/inject_anomaly.py --clear
"""

import argparse
import asyncio
import sys
from pathlib import Path
import httpx

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sim.client import (
    ProtoTwinClient,
    MockProtoTwinClient,
    ADDR_JOINT_TORQUE,
    ADDR_JOINT_VELOCITY,
    ADDR_JOINT_POSITION,
    UR5E_JOINT_LIMITS,
)


SCENARIOS = {
    "torque_spike": {
        "description": "Joint 3 torque spike — exceeds UR5e rated maximum of 150 Nm",
        "joint": 3,
        "type": "torque",
        "value": 188.0,
    },
    "velocity_overshoot": {
        "description": "Joint 2 velocity overshoot — exceeds max angular velocity",
        "joint": 2,
        "type": "velocity",
        "value": 5.5,  # UR5e max is 3.14 rad/s for joints 1-3
    },
    "position_drift": {
        "description": "Joint 5 position drift — outside expected motion envelope",
        "joint": 5,
        "type": "position",
        "value": 4.5,
    },
    "multi_joint_stress": {
        "description": "Joint 1 torque stress",
        "joint": 1,
        "type": "torque",
        "value": 168.0,
    },
}


def get_signal_address(joint: int, signal_type: str) -> int:
    addr_map = {
        "torque": ADDR_JOINT_TORQUE,
        "velocity": ADDR_JOINT_VELOCITY,
        "position": ADDR_JOINT_POSITION,
    }
    if signal_type not in addr_map:
        raise ValueError(f"Unknown signal type: {signal_type}. Use: torque, velocity, position")
    key = f"joint_{joint}_{signal_type}"
    return addr_map[signal_type][key]


def get_normal_range(joint: int, signal_type: str) -> str:
    limits = UR5E_JOINT_LIMITS.get(f"joint_{joint}")
    if not limits:
        return "unknown"
    if signal_type == "position":
        lo, hi = limits["position"]
        return f"[{lo:.2f}, {hi:.2f}] rad"
    elif signal_type == "velocity":
        return f"[0, {limits['velocity']:.2f}] rad/s"
    elif signal_type == "torque":
        return f"[0, {limits['torque']:.1f}] Nm"
    return "unknown"


def try_live_service_inject(joint: int, signal_type: str, value: float) -> bool:
    """Attempts to inject the anomaly directly into the running Anomaly Service on port 8001."""
    try:
        with httpx.Client(timeout=1.5) as client:
            res = client.get("http://localhost:8001/health")
            if res.status_code == 200:
                post_res = client.post(
                    f"http://localhost:8001/inject-anomaly?joint={joint}&anomaly_type={signal_type}&value={value}"
                )
                if post_res.status_code == 200:
                    data = post_res.json()
                    print("\n" + "=" * 60)
                    print("  [LIVE INJECTION] Sent to Running Anomaly Service (Port 8001)")
                    print("=" * 60)
                    print(f"  Target:        joint_{joint}_{signal_type}")
                    print(f"  Injected Val:  {value}")
                    print(f"  Normal Range:  {get_normal_range(joint, signal_type)}")
                    print(f"  Server Msg:    {data.get('message')}")
                    print("=" * 60)
                    print("[+] Live telemetry stream updated. Check alert service (8002) and UI.")
                    return True
    except Exception:
        pass
    return False


def try_live_service_clear() -> bool:
    """Attempts to clear anomalies on the running Anomaly Service on port 8001."""
    try:
        with httpx.Client(timeout=1.5) as client:
            res = client.post("http://localhost:8001/clear-anomaly")
            if res.status_code == 200:
                print("\n[+] Cleared active anomaly on running Anomaly Service (Port 8001).")
                return True
    except Exception:
        pass
    return False


async def inject_with_real_client(joint: int, signal_type: str, value: float, model_path: str):
    """Inject anomaly via real ProtoTwin connection."""
    client = ProtoTwinClient(model_path=model_path)
    try:
        await client.connect()
    except Exception as e:
        print(f"\n[!] Could not connect to real ProtoTwin software: {e}")
        print("[!] Tip: For local testing and dev, use the running service or mock mode.")
        return

    addr = get_signal_address(joint, signal_type)
    print(f"[inject] Writing joint_{joint}_{signal_type} = {value} (addr {addr}) to ProtoTwin...")
    client.write_signal(addr, value)
    await client.step()
    print("[inject] Value applied to simulation.")
    await client.disconnect()


async def inject_with_mock(joint: int, signal_type: str, value: float):
    """Standalone mock anomaly demonstration."""
    client = MockProtoTwinClient(step_interval=0.1)
    await client.connect()

    normal_range = get_normal_range(joint, signal_type)
    print(f"\n{'='*60}")
    print(f"  STANDALONE MOCK ANOMALY STREAM DEMO")
    print(f"{'='*60}")
    print(f"  Joint:        {joint}")
    print(f"  Signal:       {signal_type}")
    print(f"  Value:        {value}")
    print(f"  Normal range: {normal_range}")
    print(f"{'='*60}\n")

    step = 0
    async for reading in client.stream_sensors(max_steps=35):
        if step == 10:
            client.inject_anomaly(joint=joint, anomaly_type=signal_type, magnitude=value)
            print(f"\n  >>> ANOMALY INJECTED at step {step} <<<\n")
        if step == 25:
            client.clear_anomaly()
            print(f"\n  >>> ANOMALY CLEARED at step {step} <<<\n")

        key = f"joint_{joint}_{signal_type}"
        val = reading.sensors.get(key, "N/A")
        marker = " *** ANOMALOUS ***" if 10 <= step < 25 else ""
        print(f"  step={step:3d}  {key}={val}{marker}")
        step += 1

    await client.disconnect()


def list_scenarios():
    print(f"\n{'='*60}")
    print("  PREDEFINED ANOMALY SCENARIOS")
    print(f"{'='*60}\n")
    for name, s in SCENARIOS.items():
        print(f"  {name}:")
        print(f"    {s['description']}")
        print(f"    Joint: {s['joint']}, Type: {s['type']}, Value: {s['value']}")
        print(f"    Normal range: {get_normal_range(s['joint'], s['type'])}\n")


def main():
    parser = argparse.ArgumentParser(description="Inject anomalies into UR5e simulation.")
    parser.add_argument("--joint", type=int, choices=[1, 2, 3, 4, 5, 6], help="Joint number (1-6)")
    parser.add_argument("--type", type=str, choices=["torque", "velocity", "position"], help="Signal type")
    parser.add_argument("--value", type=float, help="Anomalous value to inject")
    parser.add_argument("--scenario", type=str, choices=list(SCENARIOS.keys()), help="Use a predefined scenario")
    parser.add_argument("--clear", action="store_true", help="Clear currently injected anomaly")
    parser.add_argument("--mock", action="store_true", help="Run standalone mock generator")
    parser.add_argument("--real", action="store_true", help="Force direct connection to ProtoTwin desktop app")
    parser.add_argument("--model", type=str, default="sim/prototwin_project/UR5e.ptm", help="Path to ProtoTwin model")
    parser.add_argument("--list-scenarios", action="store_true", help="List predefined anomaly scenarios")

    args = parser.parse_args()

    if args.list_scenarios:
        list_scenarios()
        return

    if args.clear:
        if try_live_service_clear():
            return
        print("[+] Anomaly cleared.")
        return

    # Resolve scenario or parameters
    if args.scenario:
        scenario = SCENARIOS[args.scenario]
        joint = scenario["joint"]
        signal_type = scenario["type"]
        value = args.value if args.value is not None else scenario["value"]
    elif args.joint and args.type and args.value is not None:
        joint = args.joint
        signal_type = args.type
        value = args.value
    else:
        parser.error("Provide --scenario OR (--joint, --type, --value) OR --clear")
        return

    # 1. If real ProtoTwin requested explicitly
    if args.real:
        asyncio.run(inject_with_real_client(joint, signal_type, value, args.model))
        return

    # 2. Check if the live backend is running (port 8001)
    if not args.mock and try_live_service_inject(joint, signal_type, value):
        return

    # 3. Otherwise run standalone mock
    asyncio.run(inject_with_mock(joint, signal_type, value))


if __name__ == "__main__":
    main()
