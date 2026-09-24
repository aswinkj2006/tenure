"""
Tenure — Anomaly injection script for the UR5e simulation.

Manually triggers an anomaly by forcing out-of-range values on a
specified joint. Works with both the real ProtoTwin client and the
mock client for development.

Usage:
    # Inject torque spike on joint 3 (mock mode for dev)
    python sim/inject_anomaly.py --joint 3 --type torque --value 185.0 --mock

    # Inject via real ProtoTwin
    python sim/inject_anomaly.py --joint 3 --type torque --value 185.0

    # Clear anomaly after injection
    python sim/inject_anomaly.py --clear --mock
"""

import argparse
import asyncio
import sys
import json
import math
from pathlib import Path

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


# Predefined anomaly scenarios for quick demo use
SCENARIOS = {
    "torque_spike": {
        "description": "Joint 3 torque spike — exceeds UR5e rated maximum of 150 Nm",
        "joint": 3,
        "type": "torque",
        "value": 185.0,
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
        "value": 4.5,  # significant drift from normal operating range
    },
    "multi_joint_stress": {
        "description": "Joints 1 and 2 simultaneous torque stress",
        "joint": 1,
        "type": "torque",
        "value": 160.0,
    },
}


def get_signal_address(joint: int, signal_type: str) -> int:
    """Get the ProtoTwin signal address for a joint and signal type."""
    addr_map = {
        "torque": ADDR_JOINT_TORQUE,
        "velocity": ADDR_JOINT_VELOCITY,
        "position": ADDR_JOINT_POSITION,
    }

    if signal_type not in addr_map:
        raise ValueError(f"Unknown signal type: {signal_type}. Use: torque, velocity, position")

    key = f"joint_{joint}_{signal_type}"
    addresses = addr_map[signal_type]

    if key not in addresses:
        raise ValueError(f"Unknown signal: {key}. Valid joints: 1-6")

    return addresses[key]


def get_normal_range(joint: int, signal_type: str) -> str:
    """Get the normal operating range for a joint signal (for display)."""
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


async def inject_with_real_client(joint: int, signal_type: str, value: float, model_path: str):
    """Inject anomaly via real ProtoTwin connection."""
    client = ProtoTwinClient(model_path=model_path)
    await client.connect()

    addr = get_signal_address(joint, signal_type)
    normal_range = get_normal_range(joint, signal_type)

    print(f"\n{'='*60}")
    print(f"  ANOMALY INJECTION")
    print(f"{'='*60}")
    print(f"  Joint:        {joint}")
    print(f"  Signal:       {signal_type}")
    print(f"  Value:        {value}")
    print(f"  Normal range: {normal_range}")
    print(f"  Address:      {addr}")
    print(f"{'='*60}\n")

    client.write_signal(addr, value)
    await client.step()  # Advance one step so the value takes effect

    print(f"[inject] Written joint_{joint}_{signal_type} = {value} to ProtoTwin.")
    print(f"[inject] The anomaly detection service should flag this on the next read.")

    await client.disconnect()


async def inject_with_mock(joint: int, signal_type: str, value: float):
    """Inject anomaly and stream data to show the effect."""
    client = MockProtoTwinClient(step_interval=0.1)
    await client.connect()

    normal_range = get_normal_range(joint, signal_type)

    print(f"\n{'='*60}")
    print(f"  MOCK ANOMALY INJECTION")
    print(f"{'='*60}")
    print(f"  Joint:        {joint}")
    print(f"  Signal:       {signal_type}")
    print(f"  Value:        {value}")
    print(f"  Normal range: {normal_range}")
    print(f"{'='*60}\n")

    step = 0
    async for reading in client.stream_sensors(max_steps=50):
        # Inject at step 20
        if step == 20:
            client.inject_anomaly(joint=joint, anomaly_type=signal_type, magnitude=value)
            print(f"\n  >>> ANOMALY INJECTED at step {step} <<<\n")

        # Clear at step 40
        if step == 40:
            client.clear_anomaly()
            print(f"\n  >>> ANOMALY CLEARED at step {step} <<<\n")

        # Print the relevant sensor
        key = f"joint_{joint}_{signal_type}"
        val = reading.sensors.get(key, "N/A")
        marker = " *** ANOMALOUS ***" if step >= 20 and step < 40 else ""
        print(f"  step={step:3d}  {key}={val}{marker}")

        step += 1

    await client.disconnect()


def list_scenarios():
    """Print all predefined anomaly scenarios."""
    print(f"\n{'='*60}")
    print(f"  PREDEFINED ANOMALY SCENARIOS")
    print(f"{'='*60}\n")

    for name, scenario in SCENARIOS.items():
        print(f"  {name}:")
        print(f"    {scenario['description']}")
        print(f"    Joint: {scenario['joint']}, Type: {scenario['type']}, Value: {scenario['value']}")
        print(f"    Normal range: {get_normal_range(scenario['joint'], scenario['type'])}")
        print()

    print(f"  Usage: python sim/inject_anomaly.py --scenario torque_spike --mock")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Inject anomalies into the UR5e ProtoTwin simulation."
    )
    parser.add_argument("--joint", type=int, choices=[1, 2, 3, 4, 5, 6], help="Joint number (1-6)")
    parser.add_argument("--type", type=str, choices=["torque", "velocity", "position"], help="Signal type")
    parser.add_argument("--value", type=float, help="Anomalous value to inject")
    parser.add_argument("--scenario", type=str, choices=list(SCENARIOS.keys()), help="Use a predefined scenario")
    parser.add_argument("--mock", action="store_true", help="Use mock client (no ProtoTwin needed)")
    parser.add_argument("--model", type=str, default="sim/prototwin_project/UR5e.ptm", help="Path to ProtoTwin model")
    parser.add_argument("--list-scenarios", action="store_true", help="List predefined anomaly scenarios")

    args = parser.parse_args()

    if args.list_scenarios:
        list_scenarios()
        return

    # Resolve scenario or manual params
    if args.scenario:
        scenario = SCENARIOS[args.scenario]
        joint = scenario["joint"]
        signal_type = scenario["type"]
        value = scenario["value"]
    elif args.joint and args.type and args.value is not None:
        joint = args.joint
        signal_type = args.type
        value = args.value
    else:
        parser.error("Provide either --scenario or all of --joint, --type, --value")
        return

    if args.mock:
        asyncio.run(inject_with_mock(joint, signal_type, value))
    else:
        asyncio.run(inject_with_real_client(joint, signal_type, value, args.model))


if __name__ == "__main__":
    main()
