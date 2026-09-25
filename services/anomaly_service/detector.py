"""
Tenure — Zero-Shot Anomaly Detection Engine

Implements multi-signal time-series anomaly detection on UR5e industrial telemetry:
1. Physical Domain Envelopes: Hard UR5e joint limits (torque, velocity, position).
2. Dynamic Rolling-Window Z-Score: Zero-shot statistical anomaly scoring over a
   sliding window of historical readings without needing prior fine-tuning data.
3. Severity Tiering: Maps deviations to 'low', 'medium', 'high', 'critical'.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Any
import math

# UR5e spec limits
UR5E_JOINT_LIMITS = {
    "joint_1": {"position": (-6.2832, 6.2832), "velocity": 3.14, "torque": 150.0},
    "joint_2": {"position": (-6.2832, 6.2832), "velocity": 3.14, "torque": 150.0},
    "joint_3": {"position": (-3.1416, 3.1416), "velocity": 3.14, "torque": 150.0},
    "joint_4": {"position": (-6.2832, 6.2832), "velocity": 6.28, "torque": 28.0},
    "joint_5": {"position": (-6.2832, 6.2832), "velocity": 6.28, "torque": 28.0},
    "joint_6": {"position": (-6.2832, 6.2832), "velocity": 6.28, "torque": 28.0},
}


@dataclass
class AnomalyResult:
    is_anomaly: bool
    flagged_sensors: list[str] = field(default_factory=list)
    deviation_magnitude: dict[str, float] = field(default_factory=dict)
    severity: str = "low"  # low, medium, high, critical
    details: dict[str, Any] = field(default_factory=dict)


class AnomalyDetector:
    """
    Sliding-window zero-shot anomaly detector.
    Evaluates both physical envelope violations and statistical Z-score shifts.
    """

    def __init__(self, window_size: int = 60, z_threshold: float = 3.5):
        self.window_size = window_size
        self.z_threshold = z_threshold
        # Sliding buffer of sensor readings: dict of deque per sensor
        self.history: dict[str, deque[float]] = {}

    def _update_history(self, sensors: dict[str, float]):
        for key, val in sensors.items():
            if key not in self.history:
                self.history[key] = deque(maxlen=self.window_size)
            self.history[key].append(val)

    def evaluate(self, reading: dict[str, Any]) -> AnomalyResult:
        sensors: dict[str, float] = reading.get("sensors", {})
        flagged: list[str] = []
        deviations: dict[str, float] = {}
        highest_severity_rank = 0  # 0: none, 1: low, 2: medium, 3: high, 4: critical
        details: dict[str, Any] = {}

        rank_to_severity = {0: "low", 1: "low", 2: "medium", 3: "high", 4: "critical"}

        for sensor_name, val in sensors.items():
            sensor_sev_rank = 0
            dev_mag = 0.0

            # 1. Physical Domain Check (Torque & Velocity limits)
            for joint_idx in range(1, 7):
                joint_key = f"joint_{joint_idx}"
                if sensor_name == f"{joint_key}_torque":
                    max_torque = UR5E_JOINT_LIMITS[joint_key]["torque"]
                    abs_val = abs(val)
                    if abs_val > max_torque:
                        ratio = abs_val / max_torque
                        dev_mag = round(abs_val - max_torque, 2)
                        if ratio >= 1.2:
                            sensor_sev_rank = max(sensor_sev_rank, 4)  # critical
                        elif ratio >= 1.05:
                            sensor_sev_rank = max(sensor_sev_rank, 3)  # high
                        else:
                            sensor_sev_rank = max(sensor_sev_rank, 2)  # medium
                elif sensor_name == f"{joint_key}_velocity":
                    max_vel = UR5E_JOINT_LIMITS[joint_key]["velocity"]
                    abs_val = abs(val)
                    if abs_val > max_vel:
                        ratio = abs_val / max_vel
                        dev_mag = round(abs_val - max_vel, 2)
                        if ratio >= 1.25:
                            sensor_sev_rank = max(sensor_sev_rank, 4)
                        elif ratio >= 1.1:
                            sensor_sev_rank = max(sensor_sev_rank, 3)
                        else:
                            sensor_sev_rank = max(sensor_sev_rank, 2)

            # 2. Rolling Window Statistical Check (Z-score)
            if sensor_name in self.history and len(self.history[sensor_name]) >= 15:
                buf = list(self.history[sensor_name])
                mean = sum(buf) / len(buf)
                variance = sum((x - mean) ** 2 for x in buf) / len(buf)
                std = math.sqrt(variance)

                # Require non-trivial variation and magnitude before triggering Z-score anomaly
                if std > 0.35 and abs(val - mean) > 2.0:
                    z_score = abs(val - mean) / std
                    if z_score >= self.z_threshold:
                        stat_dev = round(abs(val - mean), 2)
                        dev_mag = max(dev_mag, stat_dev)

                        if z_score >= 6.0:
                            sensor_sev_rank = max(sensor_sev_rank, 4)
                        elif z_score >= 4.5:
                            sensor_sev_rank = max(sensor_sev_rank, 3)
                        else:
                            sensor_sev_rank = max(sensor_sev_rank, 2)
                        details[sensor_name] = {
                            "z_score": round(z_score, 2),
                            "baseline_mean": round(mean, 2),
                            "baseline_std": round(std, 2),
                        }

            if sensor_sev_rank > 0:
                flagged.append(sensor_name)
                deviations[sensor_name] = dev_mag
                highest_severity_rank = max(highest_severity_rank, sensor_sev_rank)

        # Update rolling history after checking this step
        self._update_history(sensors)

        is_anomaly = len(flagged) > 0
        severity = rank_to_severity[highest_severity_rank] if is_anomaly else "low"

        return AnomalyResult(
            is_anomaly=is_anomaly,
            flagged_sensors=flagged,
            deviation_magnitude=deviations,
            severity=severity,
            details=details,
        )
