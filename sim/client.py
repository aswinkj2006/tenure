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
from pathlib import Path
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
            try:
                await self._client.initialize()
                print("[prototwin] Subscriptions initialized via initialize()!")
            except Exception as init_err:
                print(f"[prototwin] initialize notice: {init_err}, falling back to sync()")
                await self._client.sync()
            self._running = True
            print("[prototwin] Attached to running ProtoTwin model with persistent link (port 8084)!")
            return
        except Exception as e:
            print(f"[prototwin] Could not attach directly: {e}. Trying fallback...")

        # 2. Start ProtoTwinConnect process
        connect_exe = r"C:\Program Files\ProtoTwin\Connect\ProtoTwinConnect.exe"
        location = connect_exe if Path(connect_exe).exists() else "ProtoTwinConnect"
        self._client = await prototwin.start(location=location)
        ptm_candidates = [
            self.model_path,
            r"C:\Users\Aswin K J\Documents\ur5e.ptm",
        ]
        for p in ptm_candidates:
            if p and Path(p).exists():
                try:
                    await self._client.load(str(p))
                    print(f"[prototwin] Loaded model: {p}")
                    break
                except Exception as load_err:
                    print(f"[prototwin] Could not load {p}: {load_err}")
        if self._client:
            await self._client.initialize()
            print("[prototwin] Connected and initialized signal tracking.")
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
    Generates realistic industrial pick-and-place trajectory with smooth kinematics,
    dynamic torque profiles, gradual breakdown degradation ramping, and emergency stop.
    """

    def __init__(self, machine_id: str = "ur5e-001", step_interval: float = 0.1):
        super().__init__(model_path="", machine_id=machine_id, step_interval=step_interval)
        self._step_count = 0
        self._anomaly_active = False
        self._anomaly_joint: int | None = None
        self._anomaly_type: str | None = None
        self._anomaly_magnitude: float = 0.0

        # Gradual degradation simulation state
        self._gradual_active = False
        self._gradual_joint = 3
        self._gradual_ramp_val = 0.0
        self._gradual_rate = 2.8  # Nm per second
        self._emergency_stop = False
        self._frozen_sensors: dict[str, float] = {}

    async def connect(self):
        self._running = True
        print("[mock] Mock ProtoTwin client started — generating industrial pick-and-place telemetry.")

    async def disconnect(self):
        self._running = False
        print("[mock] Mock ProtoTwin client stopped.")

    def start_gradual_degradation(self, joint: int = 3, rate_per_sec: float = 3.2):
        """Begin slowly ramping up torque to simulate gradual mechanical degradation."""
        self._gradual_active = True
        self._gradual_joint = joint
        self._gradual_ramp_val = 0.0
        self._gradual_rate = rate_per_sec
        self._emergency_stop = False
        print(f"[mock] Gradual mechanical breakdown simulation initiated on Joint {joint} (ramp rate: +{rate_per_sec} Nm/s).")

    def trigger_emergency_stop(self):
        """Engage immediate safety stop, freezing kinematic motion at current pose."""
        self._emergency_stop = True
        print("[mock] EMERGENCY STOP ENGAGED: Arm kinematics frozen at current pose.")

    def reset_emergency_stop(self):
        """Release emergency stop and return to nominal operating state."""
        self._emergency_stop = False
        self._gradual_active = False
        self._gradual_ramp_val = 0.0
        self._anomaly_active = False
        self._frozen_sensors = {}
        print("[mock] Emergency stop cleared. Nominal pick-and-place operation resumed.")

    def inject_anomaly(
        self, joint: int, anomaly_type: str = "torque", magnitude: float = 185.0
    ):
        """Inject a simulated instant anomaly into the mock data stream."""
        self._anomaly_active = True
        self._anomaly_joint = joint
        self._anomaly_type = anomaly_type
        self._anomaly_magnitude = magnitude
        print(f"[mock] Anomaly injected: joint_{joint}_{anomaly_type} = {magnitude}")

    def clear_anomaly(self):
        """Clear all active anomalies and reset degradation."""
        self._anomaly_active = False
        self._anomaly_joint = None
        self._anomaly_type = None
        self._gradual_active = False
        self._gradual_ramp_val = 0.0
        self._emergency_stop = False
        self._frozen_sensors = {}
        print("[mock] All anomalies cleared.")

    def read_all_sensors(self) -> dict[str, float]:
        import math
        import random

        # If E-Stop is active, freeze all joint positions and hold the fault state
        if self._emergency_stop and self._frozen_sensors:
            frozen = dict(self._frozen_sensors)
            # Add minor sensor noise to torques while held under static load
            for k in list(frozen.keys()):
                if "velocity" in k:
                    frozen[k] = 0.0
                elif "torque" in k:
                    frozen[k] = round(frozen[k] + random.gauss(0, 0.15), 2)
            frozen["emergency_stop"] = 1.0
            return frozen

        # ── Realistic Industrial Pick-and-Place Cycle (10-second period) ──
        # Cycle Breakdown:
        # 0.0 - 1.5s: Standby hover at Pick Station (Feeder)
        # 1.5 - 3.0s: Descend, close gripper around machined part
        # 3.0 - 4.5s: Lift part vertically
        # 4.5 - 6.5s: Swing Base Joint 1 to Place Station (Conveyor)
        # 6.5 - 8.0s: Descend, open gripper to deposit part
        # 8.0 - 10.0s: Retract up and swing back to Pick Station
        cycle_period = 10.0
        t = (self._step_count * self.step_interval) % cycle_period

        # Interpolate waypoints
        if t < 1.5:
            # Standby hover at pick station
            j1 = -0.52
            j2 = -0.85
            j3 = 1.35
            j4 = -0.50
            j5 = 0.0
            j6 = 0.0
            gripper = 0.0
            phase_speed = 0.0
        elif t < 3.0:
            # Descend to pick
            p = (t - 1.5) / 1.5
            s = math.sin(p * math.pi * 0.5)
            j1 = -0.52
            j2 = -0.85 - 0.30 * s
            j3 = 1.35 + 0.38 * s
            j4 = -0.50 - 0.08 * s
            j5 = 0.0
            j6 = 0.0
            gripper = 1.0 if p > 0.6 else 0.0
            phase_speed = 0.25 * math.cos(p * math.pi * 0.5)
        elif t < 4.5:
            # Lift part up
            p = (t - 3.0) / 1.5
            s = math.sin(p * math.pi * 0.5)
            j1 = -0.52
            j2 = -1.15 + 0.30 * s
            j3 = 1.73 - 0.38 * s
            j4 = -0.58 + 0.08 * s
            j5 = 0.0
            j6 = 0.0
            gripper = 1.0
            phase_speed = 0.25 * math.cos(p * math.pi * 0.5)
        elif t < 6.5:
            # Swing to place station
            p = (t - 4.5) / 2.0
            s = 0.5 * (1.0 - math.cos(p * math.pi))  # smooth S-curve
            j1 = -0.52 + 1.25 * s
            j2 = -0.85 + 0.05 * math.sin(p * math.pi)
            j3 = 1.35 + 0.05 * math.sin(p * math.pi)
            j4 = -0.50
            j5 = 0.1 * math.sin(p * math.pi)
            j6 = 0.2 * s
            gripper = 1.0
            phase_speed = 0.62 * math.sin(p * math.pi)
        elif t < 8.0:
            # Descend to place on conveyor
            p = (t - 6.5) / 1.5
            s = math.sin(p * math.pi * 0.5)
            j1 = 0.73
            j2 = -0.85 - 0.26 * s
            j3 = 1.35 + 0.32 * s
            j4 = -0.50 - 0.06 * s
            j5 = 0.0
            j6 = 0.2
            gripper = 0.0 if p > 0.5 else 1.0
            phase_speed = 0.22 * math.cos(p * math.pi * 0.5)
        else:
            # Retract and swing back to pick
            p = (t - 8.0) / 2.0
            s = 0.5 * (1.0 - math.cos(p * math.pi))
            j1 = 0.73 - 1.25 * s
            j2 = -1.11 + 0.26 * s
            j3 = 1.67 - 0.32 * s
            j4 = -0.56 + 0.06 * s
            j5 = 0.0
            j6 = 0.2 * (1.0 - s)
            gripper = 0.0
            phase_speed = 0.62 * math.sin(p * math.pi)

        # Noise and sensor readings dict
        sensors = {}
        target_positions = [j1, j2, j3, j4, j5, j6]
        nominal_torques = [32.0, 58.0, 48.0, 11.5, 7.8, 3.2]

        for i in range(1, 7):
            pos = target_positions[i - 1]
            sensors[f"joint_{i}_position"] = round(pos + random.gauss(0, 0.001), 4)
            vel = phase_speed if i in (1, 2, 3) else 0.05 * math.sin(t * 2)
            sensors[f"joint_{i}_velocity"] = round(vel + random.gauss(0, 0.005), 4)

            # Torques: nominal dynamic profile
            base_t = nominal_torques[i - 1] + 6.0 * math.sin(t * 0.8 + i)
            if gripper > 0.5 and i in (2, 3):
                base_t += 5.5  # workpiece payload torque
            sensors[f"joint_{i}_torque"] = round(base_t + random.gauss(0, 0.4), 2)

        # Gripper & tool center point
        sensors["gripper_position"] = gripper
        sensors["emergency_stop"] = 0.0
        sensors["tcp_x"] = round(0.45 * math.cos(j1) + random.gauss(0, 0.001), 4)
        sensors["tcp_y"] = round(0.45 * math.sin(j1) + random.gauss(0, 0.001), 4)
        sensors["tcp_z"] = round(0.25 - 0.15 * math.sin(j2) + random.gauss(0, 0.001), 4)

        # ── Handle Gradual Mechanical Degradation (Harmonic Reducer Drift) ──
        if self._gradual_active:
            self._gradual_ramp_val += self._gradual_rate * self.step_interval
            target_key = f"joint_{self._gradual_joint}_torque"
            sensors[target_key] = round(sensors[target_key] + self._gradual_ramp_val, 2)
            # Add thermal drift and micro-vibration signatures
            sensors["motor_temperature"] = round(42.0 + (self._gradual_ramp_val * 0.22), 1)

            # Automatic safety cutoff if it reaches critical threshold (>148 Nm)
            if sensors[target_key] >= 148.0 and not self._emergency_stop:
                print(f"[mock] CRITICAL THRESHOLD EXCEEDED ({sensors[target_key]} Nm)! Engaging E-Stop.")
                self.trigger_emergency_stop()

        # Handle instant injected anomaly
        if self._anomaly_active and self._anomaly_joint is not None:
            key = f"joint_{self._anomaly_joint}_{self._anomaly_type}"
            if key in sensors:
                sensors[key] = self._anomaly_magnitude

        if self._emergency_stop:
            self._frozen_sensors = dict(sensors)

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
