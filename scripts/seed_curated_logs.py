"""
Tenure — Seed Curated Audit Logs
Cleans development anomaly records and seeds exactly 5 realistic, professional industrial logs.
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

DB_PATH = Path(__file__).parent.parent / "db" / "tenure.db"

def seed_curated_logs():
    now = datetime.now(timezone.utc)
    t1 = (now - timedelta(minutes=14)).isoformat()
    t2 = (now - timedelta(hours=2, minutes=30)).isoformat()
    t3 = (now - timedelta(hours=6, minutes=15)).isoformat()
    t4 = (now - timedelta(hours=18, minutes=45)).isoformat()
    t5 = (now - timedelta(days=1, hours=4)).isoformat()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Clear out past raw/test records
    cursor.execute("DELETE FROM feedback")
    cursor.execute("DELETE FROM diagnoses")
    cursor.execute("DELETE FROM conversation_logs")
    cursor.execute("DELETE FROM anomaly_records")

    # Ensure machines exist
    cursor.execute("""
        INSERT OR IGNORE INTO machines (machine_id, name, type, install_date)
        VALUES 
        ('ur5e-001', 'UR5e Demo Unit (Cell 04)', 'UR5e', '2025-01-15'),
        ('kuka-kr10-01', 'KUKA KR 10 Cybertech (Bay 02)', 'KR 10', '2024-11-20'),
        ('fanuc-crx-02', 'FANUC CRX-10iA (Line 01)', 'CRX-10iA', '2024-08-10')
    """)

    curated_records = [
        {
            "id": "inc-2026-001",
            "machine_id": "ur5e-001",
            "ts": t1,
            "flagged_sensors": ["joint_3_torque", "motor_temperature"],
            "deviation_magnitude": {"joint_3_torque": 48.5, "motor_temperature": 8.2},
            "severity": "critical",
            "status": "resolved",
            "created_at": t1,
            "diagnosis": {
                "id": "diag-2026-001",
                "llm_output": "Joint 3 (Elbow Harmonic Reducer) torque drift reached 148.5 Nm (safety cutoff: 150.0 Nm). Autonomous zero-shot anomaly detector engaged safety emergency stop to prevent catastrophic gear tooth spalling. Thermal dissipation elevated to 50.2°C.",
                "citations": [
                    {"source_ref": "UR5e_Service_Manual.md#sec-4.2", "text": "Elbow Joint rated maximum continuous torque is 150 Nm. Over-torque indicates harmonic drive degradation."},
                    {"source_ref": "UR5e_Service_Manual.md#sec-5.3", "text": "Lubricate harmonic wave generator with Klüberplex BEM 34-132 or Mobilgrease 28 every 5,000 hrs."}
                ],
                "confidence": 0.94,
            },
            "feedback": {
                "id": "fb-2026-001",
                "outcome": "confirmed",
                "confirmed_cause": "Replaced degraded grease in Joint 3 harmonic drive; verified backlash <0.018mm and cleared metallic particulate obstruction.",
                "ts": t1,
            },
            "messages": [
                {"role": "assistant", "content": "🚨 Autonomous Safety Stop Engaged: Joint 3 torque exceeded 148 Nm envelope.", "ts": t1},
                {"role": "user", "content": "What lubricant should I use for Joint 3 harmonic gearbox?", "ts": t1},
                {"role": "assistant", "content": "According to Section 5.3 of the UR5e Service Manual, use Klüberplex BEM 34-132 or Mobilgrease 28. Apply 15g evenly across wave generator teeth.", "ts": t1},
                {"role": "user", "content": "Grease replaced, backlash within spec. Ready to restart.", "ts": t1}
            ]
        },
        {
            "id": "inc-2026-002",
            "machine_id": "ur5e-001",
            "ts": t2,
            "flagged_sensors": ["joint_5_velocity", "camera_evm_displacement"],
            "deviation_magnitude": {"joint_5_velocity": 0.35, "camera_evm_displacement": 0.042},
            "severity": "high",
            "status": "open",
            "created_at": t2,
            "diagnosis": {
                "id": "diag-2026-002",
                "llm_output": "Eulerian Video Magnification (EVM) sub-pixel optical analysis detected 38 Hz chattering resonance on Wrist 2 during high-speed deceleration. Angular velocity ripple ±0.35 rad/s observed.",
                "citations": [
                    {"source_ref": "UR5e_Service_Manual.md#sec-6.1", "text": "Wrist joint vibration above 30 Hz typically stems from tool flange bolt loosening or gripper payload misalignment."}
                ],
                "confidence": 0.89,
            },
            "feedback": None,
            "messages": [
                {"role": "assistant", "content": "Optical sensing detected 38 Hz resonance on Wrist 2. Recommended: Inspect tool flange mounting bolts.", "ts": t2}
            ]
        },
        {
            "id": "inc-2026-003",
            "machine_id": "kuka-kr10-01",
            "ts": t3,
            "flagged_sensors": ["joint_2_velocity", "tcp_speed"],
            "deviation_magnitude": {"joint_2_velocity": 0.25, "tcp_speed": 0.18},
            "severity": "medium",
            "status": "resolved",
            "created_at": t3,
            "diagnosis": {
                "id": "diag-2026-003",
                "llm_output": "Shoulder Axis J2 velocity overshoot detected at 2.45 rad/s during high-inertia palletizing transfer, exceeding nominal trajectory envelope by 11.4%.",
                "citations": [
                    {"source_ref": "KUKA_KR10_Operating_Instructions.pdf#p-45", "text": "Axis 2 maximum nominal speed is 2.20 rad/s with maximum 10 kg end-effector payload."}
                ],
                "confidence": 0.91,
            },
            "feedback": {
                "id": "fb-2026-003",
                "outcome": "confirmed",
                "confirmed_cause": "Recalibrated trajectory jerk filter smoothing profile (C² continuous S-curve ramp). Verified within safety envelope.",
                "ts": t3,
            },
            "messages": [
                {"role": "assistant", "content": "J2 velocity exceeded 2.2 rad/s limit during part swing.", "ts": t3},
                {"role": "user", "content": "Trajectory jerk smoothing profile adjusted to 0.4s ramp.", "ts": t3}
            ]
        },
        {
            "id": "inc-2026-004",
            "machine_id": "fanuc-crx-02",
            "ts": t4,
            "flagged_sensors": ["motor_temperature", "ambient_temp"],
            "deviation_magnitude": {"motor_temperature": 11.8},
            "severity": "low",
            "status": "resolved",
            "created_at": t4,
            "diagnosis": {
                "id": "diag-2026-004",
                "llm_output": "FLIR thermal radiometry registered stator housing surface temperature rise from 41°C to 53°C over a 15-minute operational window without accompanying torque increase.",
                "citations": [
                    {"source_ref": "FANUC_CRX10_Maintenance_Manual.pdf#sec-3", "text": "Base motor stator temperature should remain below 60°C under 40°C ambient ventilation conditions."}
                ],
                "confidence": 0.85,
            },
            "feedback": {
                "id": "fb-2026-004",
                "outcome": "confirmed",
                "confirmed_cause": "External ambient duct airflow temporarily obstructed by transport cart. Cleared obstruction; thermal equilibrium restored to 42°C.",
                "ts": t4,
            },
            "messages": [
                {"role": "assistant", "content": "Thermal rise detected on base axis stator.", "ts": t4},
                {"role": "user", "content": "Transport cart was blocking exhaust fan duct. Cleared.", "ts": t4}
            ]
        },
        {
            "id": "inc-2026-005",
            "machine_id": "ur5e-001",
            "ts": t5,
            "flagged_sensors": ["tcp_force_z", "gripper_effort"],
            "deviation_magnitude": {"tcp_force_z": 29.2},
            "severity": "critical",
            "status": "resolved",
            "created_at": t5,
            "diagnosis": {
                "id": "diag-2026-005",
                "llm_output": "Tool Center Point (TCP) Z-axis reactive normal force reached 94.2 N during brass workpiece press-fit insertion into test jig (rated fixture limit 65.0 N).",
                "citations": [
                    {"source_ref": "UR5e_Service_Manual.md#sec-7.4", "text": "Programmed force compliance mode must restrict axial insertion force to <70 N."}
                ],
                "confidence": 0.95,
            },
            "feedback": {
                "id": "fb-2026-005",
                "outcome": "confirmed",
                "confirmed_cause": "Cleaned metal shavings from fixture locating pin bore. Part seating tolerance verified with digital dial indicator.",
                "ts": t5,
            },
            "messages": [
                {"role": "assistant", "content": "High insertion force detected on Z-axis (94.2 N).", "ts": t5},
                {"role": "user", "content": "Cleared debris from test fixture locating bore.", "ts": t5}
            ]
        }
    ]

    for rec in curated_records:
        cursor.execute("""
            INSERT INTO anomaly_records (id, machine_id, ts, flagged_sensors, deviation_magnitude, severity, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec["id"],
            rec["machine_id"],
            rec["ts"],
            json.dumps(rec["flagged_sensors"]),
            json.dumps(rec["deviation_magnitude"]),
            rec["severity"],
            rec["status"],
            rec["created_at"],
        ))

        if rec["diagnosis"]:
            diag = rec["diagnosis"]
            cursor.execute("""
                INSERT INTO diagnoses (id, anomaly_id, llm_output, citations, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                diag["id"],
                rec["id"],
                diag["llm_output"],
                json.dumps(diag["citations"]),
                diag["confidence"],
                rec["created_at"],
            ))

        if rec["feedback"]:
            fb = rec["feedback"]
            cursor.execute("""
                INSERT INTO feedback (id, diagnosis_id, outcome, confirmed_cause, ts)
                VALUES (?, ?, ?, ?, ?)
            """, (
                fb["id"],
                rec["diagnosis"]["id"],
                fb["outcome"],
                fb["confirmed_cause"],
                fb["ts"],
            ))

        if rec["messages"]:
            cursor.execute("""
                INSERT INTO conversation_logs (id, anomaly_id, machine_id, messages, started_at, resolved_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                f"conv-{rec['id']}",
                rec["id"],
                rec["machine_id"],
                json.dumps(rec["messages"]),
                rec["created_at"],
                rec["created_at"] if rec["status"] == "resolved" else None,
            ))

    conn.commit()
    conn.close()
    print(f"[seed] Successfully seeded {len(curated_records)} curated professional audit logs into {DB_PATH}.")

if __name__ == "__main__":
    seed_curated_logs()
