"""
Tenure — ProtoTwin Connect client for the UR5e simulation.

Wraps the prototwin Python package to:
  - Connect to a running ProtoTwin sim
  - Stream joint positions, velocities, torques, and TCP position
  - Provide an async generator of SensorReading dicts
  - Write signal values (used by anomaly injection)

Signal addresses are discovered via ProtoTwin's IO Browser and mapped here.
Update the address constants below to match your actual ProtoTwin model.
"""

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncGenerator

# ──────────────────────────────────────────────────────────────
# Signal address mapping for the UR5e model in ProtoTwin.
#
# These are INTEGER addresses that correspond to signals in the
# ProtoTwin model. You MUST update these after building the UR5e
# model in ProtoTwin and checking the IO Browser.
#
# Format: { "signal_name": prototwin_signal_address }
# ──────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────
# Signal address mapping for the UR5e model in ProtoTwin.
#
# Verified from live UR5e model signals in ProtoTwin Connect:
# Stride is 7 signals per joint starting at motor_state (addr 2, 9, 16, 23, 30, 37):
#   [Motor + 1] = target_position (3, 10, 17, 24, 31, 38)
#   [Motor + 2] = target_velocity (4, 11, 18, 25, 32, 39)
#   [Motor + 3] = force_limit (5, 12, 19, 26, 33, 40)
#   [Motor + 4] = current_position (6, 13, 20, 27, 34, 41)
#   [Motor + 5] = current_velocity (7, 14, 21, 28, 35, 42)
#   [Motor + 6] = current_force/torque (8, 15, 22, 29, 36, 43)
# ──────────────────────────────────────────────────────────────

ADDR_SIM_TIME = 0

# Joint positions (radians) — Actual feedback from physics engine
ADDR_JOINT_POSITION = {
    "joint_1_position": 6,
    "joint_2_position": 13,
    "joint_3_position": 20,
    "joint_4_position": 27,
    "joint_5_position": 34,
    "joint_6_position": 41,
}

# Joint velocities (rad/s) — Actual feedback
ADDR_JOINT_VELOCITY = {
    "joint_1_velocity": 7,
    "joint_2_velocity": 14,
    "joint_3_velocity": 21,
    "joint_4_velocity": 28,
    "joint_5_velocity": 35,
    "joint_6_velocity": 42,
}

# Joint torques (Nm) — Actual feedback force
ADDR_JOINT_TORQUE = {
    "joint_1_torque": 8,
    "joint_2_torque": 15,
    "joint_3_torque": 22,
    "joint_4_torque": 29,
    "joint_5_torque": 36,
    "joint_6_torque": 43,
}

# Joint motor targets (commands)
ADDR_MOTOR_TARGET = {
    "joint_1_target": 3,
    "joint_2_target": 10,
    "joint_3_target": 17,
    "joint_4_target": 24,
    "joint_5_target": 31,
    "joint_6_target": 38,
}

# Joint force / torque limits
ADDR_MOTOR_LIMIT = {
    "joint_1_limit": 5,
    "joint_2_limit": 12,
    "joint_3_limit": 19,
    "joint_4_limit": 26,
    "joint_5_limit": 33,
    "joint_6_limit": 40,
}

ADDR_TCP = {
    "tcp_x": 0,
    "tcp_y": 1,
    "tcp_z": 2,
}

# All readable sensor signals
ALL_SENSOR_ADDRESSES: dict[str, int] = {
    **ADDR_JOINT_POSITION,
    **ADDR_JOINT_VELOCITY,
    **ADDR_JOINT_TORQUE,
}


# UR5e spec limits (from official documentation)
UR5E_JOINT_LIMITS = {
    "joint_1": {"position": (-6.2832, 6.2832), "velocity": 3.14, "torque": 150.0},
    "joint_2": {"position": (-6.2832, 6.2832), "velocity": 3.14, "torque": 150.0},
    "joint_3": {"position": (-3.1416, 3.1416), "velocity": 3.14, "torque": 150.0},
    "joint_4": {"position": (-6.2832, 6.2832), "velocity": 6.28, "torque": 28.0},
    "joint_5": {"position": (-6.2832, 6.2832), "velocity": 6.28, "torque": 28.0},
    "joint_6": {"position": (-6.2832, 6.2832), "velocity": 6.28, "torque": 28.0},
}


@dataclass
class SensorReading:
    """A single timestamped snapshot of all sensor values."""
    ts: str
    machine_id: str
    sensors: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "machine_id": self.machine_id,
            "sensors": self.sensors,
        }


class ProtoTwinClient:
    """
    Async wrapper around the ProtoTwin Python client.

    Usage:
        client = ProtoTwinClient(model_path="sim/prototwin_project/UR5e.ptm")
        async for reading in client.stream_sensors():
            print(reading.to_dict())
    """

    def __init__(
        self,
        model_path: str = "sim/prototwin_project/UR5e.ptm",
        machine_id: str = "ur5e-001",
        step_interval: float = 0.1,  # seconds between steps (~10 Hz)
    ):
        self.model_path = model_path
        self.machine_id = machine_id
        self.step_interval = step_interval
        self._client = None
        self._running = False

    async def connect(self):
        """Connect to ProtoTwin: attaches to running instance on port 8084 or loads model."""
        import prototwin

        # 1. Attempt to attach to already running ProtoTwin instance with persistent link
        try:
            from websockets.legacy.client import connect as ws_connect
            from prototwin.client import Client as ProtoClient

            ws = await ws_connect(
                "ws://localhost:8084",
                compression=None,
                user_agent_header="Python",
                ping_interval=None,  # Crucial: ProtoTwin C++ backend does not handle WS pings
                close_timeout=5,
            )
            await ws.recv()
            self._client = ProtoClient(ws)
            await self._client.sync()
            self._running = True
            print("[prototwin] Attached to running ProtoTwin model with persistent link (port 8084)!")
            return
        except Exception as e:
            print(f"[prototwin] Could not attach directly: {e}. Trying fallback...")

        # 2. Start ProtoTwinConnect process
        self._client = await prototwin.start()
        if self.model_path and Path(self.model_path).exists():
            await self._client.load(self.model_path)
            await self._client.initialize()
            print(f"[prototwin] Connected and loaded model: {self.model_path}")
        self._running = True

    async def disconnect(self):
        """Stop the simulation."""
        self._running = False
        if self._client:
            try:
                if hasattr(self._client, "_ws") and self._client._ws:
                    await self._client._ws.close()
            except Exception:
                pass
            print("[prototwin] Disconnected.")

    def read_all_sensors(self) -> dict[str, float]:
        """Read all sensor values in a single snapshot."""
        if not self._client:
            raise RuntimeError("Not connected to ProtoTwin. Call connect() first.")

        values = {}
        for name, addr in ALL_SENSOR_ADDRESSES.items():
            try:
                val = self._client.get(addr)
                values[name] = float(val) if isinstance(val, (int, float, bool)) else 0.0
            except Exception:
                values[name] = 0.0
        return values

    def write_signal(self, address: int, value: float):
        """Write a value to a ProtoTwin signal address."""
        if not self._client:
            raise RuntimeError("Not connected to ProtoTwin. Call connect() first.")
        self._client.set(address, value)


    async def step(self):
        """Advance the simulation by one timestep."""
        if self._client:
            await self._client.step()

    async def stream_sensors(
        self, max_steps: int | None = None
    ) -> AsyncGenerator[SensorReading, None]:
        """
        Async generator that yields SensorReading objects at each simulation step.

        Args:
            max_steps: If set, stop after this many steps. None = run forever.
        """
        if not self._client:
            await self.connect()

        step_count = 0
        while self._running:
            # Read all sensors
            sensors = self.read_all_sensors()

            # Build the reading
            reading = SensorReading(
                ts=datetime.now(timezone.utc).isoformat(),
                machine_id=self.machine_id,
                sensors=sensors,
            )

            yield reading

            # Step the simulation
            await self.step()
            step_count += 1

            if max_steps and step_count >= max_steps:
                break

            # Throttle to maintain target frequency
            await asyncio.sleep(self.step_interval)


class MockProtoTwinClient(ProtoTwinClient):
    """
    Mock client for development without ProtoTwin installed.
    Generates realistic-looking sensor data with small random noise.
    """

    def __init__(self, machine_id: str = "ur5e-001", step_interval: float = 0.1):
        super().__init__(model_path="", machine_id=machine_id, step_interval=step_interval)
        self._step_count = 0
        self._anomaly_active = False
        self._anomaly_joint: int | None = None
        self._anomaly_type: str | None = None
        self._anomaly_magnitude: float = 0.0

    async def connect(self):
        self._running = True
        print("[mock] Mock ProtoTwin client started — generating synthetic sensor data.")

    async def disconnect(self):
        self._running = False
        print("[mock] Mock ProtoTwin client stopped.")

    def inject_anomaly(
        self, joint: int, anomaly_type: str = "torque", magnitude: float = 185.0
    ):
        """
        Inject a simulated anomaly into the mock data stream.

        Args:
            joint: Joint number (1-6)
            anomaly_type: 'torque', 'velocity', or 'position'
            magnitude: The anomalous value to inject
        """
        self._anomaly_active = True
        self._anomaly_joint = joint
        self._anomaly_type = anomaly_type
        self._anomaly_magnitude = magnitude
        print(
            f"[mock] Anomaly injected: joint_{joint}_{anomaly_type} = {magnitude}"
        )

    def clear_anomaly(self):
        """Clear the injected anomaly."""
        self._anomaly_active = False
        self._anomaly_joint = None
        self._anomaly_type = None
        print("[mock] Anomaly cleared.")

    def read_all_sensors(self) -> dict[str, float]:
        import math
        import random

        t = self._step_count * self.step_interval

        sensors = {}

        # Generate realistic UR5e joint data with sinusoidal motion
        for i in range(1, 7):
            # Positions: slow sinusoidal sweep with phase offsets
            phase = (i - 1) * 0.5
            base_pos = 0.5 * math.sin(0.3 * t + phase)
            sensors[f"joint_{i}_position"] = round(
                base_pos + random.gauss(0, 0.002), 4
            )

            # Velocities: derivative of position + noise
            base_vel = 0.5 * 0.3 * math.cos(0.3 * t + phase)
            sensors[f"joint_{i}_velocity"] = round(
                base_vel + random.gauss(0, 0.01), 4
            )

            # Torques: proportional to position + gravity-like offset + noise
            gravity_offset = [45.0, 62.0, 52.0, 12.0, 9.0, 3.0][i - 1]
            base_torque = gravity_offset + 5.0 * math.sin(0.3 * t + phase)
            sensors[f"joint_{i}_torque"] = round(
                base_torque + random.gauss(0, 0.5), 2
            )

        # TCP position
        sensors["tcp_x"] = round(0.4 + 0.1 * math.sin(0.2 * t), 4)
        sensors["tcp_y"] = round(-0.1 + 0.05 * math.cos(0.2 * t), 4)
        sensors["tcp_z"] = round(0.3 + 0.08 * math.sin(0.15 * t), 4)

        # Inject anomaly if active
        if self._anomaly_active and self._anomaly_joint is not None:
            key = f"joint_{self._anomaly_joint}_{self._anomaly_type}"
            if key in sensors:
                sensors[key] = self._anomaly_magnitude

        self._step_count += 1
        return sensors

    async def step(self):
        pass  # No real simulation to step


async def _demo():
    """Quick demo: run mock client, inject anomaly after 3 seconds."""
    client = MockProtoTwinClient(step_interval=0.1)
    await client.connect()

    step = 0
    async for reading in client.stream_sensors(max_steps=50):
        # Inject anomaly at step 30
        if step == 30:
            client.inject_anomaly(joint=3, anomaly_type="torque", magnitude=185.0)

        # Print a compact view
        torques = {
            k: v for k, v in reading.sensors.items() if "torque" in k
        }
        print(f"[{reading.ts}] torques={torques}")
        step += 1

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(_demo())
