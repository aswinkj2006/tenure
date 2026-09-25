"""
Tenure — Industrial Fleet & Autonomous Operations Seeder
======================================================
Seeds the database with:
1. Operations User Account:
   - Username: plantops.demo@industrial.com
   - Password: Tenure2026!
   - Role: Plant Reliability Overseer
2. The 4 Inbuilt Machine Architectures:
   - ur5e-001    : Universal Robots UR5e (Cell A)       -> Capability: xAI Recurrence Intelligence
   - kuka-kr10   : KUKA KR 10 Cybertech (Bay 2)         -> Capability: Dynamic Technician Dispatch Fallback
   - fanuc-crx10 : FANUC CRX-10iA (Line 1)              -> Capability: Autonomous Multi-Vendor Procurement & Governance
   - abb-irb1200 : ABB IRB 1200-5/0.9 (Cell C)          -> Capability: Real-time Telemetry & Economic Profit Yield
3. Certified Technicians with dynamic operational schedules:
   - Sarah Chen   (L3 Expert Mechatronics)   : busy (assigned to active incident)
   - Marcus Vance (L2 Robotics Specialist)   : available (KUKA certified)
   - Dave Miller  (L1 Junior Technician)     : available
   - Elena Rostova (L2 Diagnostics Engineer) : off-shift
   - Rajesh R     (L1 Field Technician)      : on-leave
4. Multi-Vendor Industrial Supply Network:
   - Apex Industrial Components (Primary supplier, 14-day backlog on servo motors)
   - MotionPro Solutions        (Secondary supplier, in-stock 24h lead-time for servo motors)
   - Universal Robots Spares APAC
   - KUKA Robotics Parts Direct
5. Historical Servicing Telemetry for ur5e-001 (for recurrence attribution analysis).
"""

import sys
import json
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from services.orchestrator.auth import hash_password
from db.init_db import get_connection

def seed_industrial_fleet():
    print("Seeding Tenure Industrial Fleet & Operations...")

    with get_connection() as conn:
        cursor = conn.cursor()

        # ──────────────────────────────────────────────────────────
        # 1. Accounts
        # ──────────────────────────────────────────────────────────
        demo_accounts = [
            ("plantops.demo@industrial.com", "Tenure2026!", "Plant Reliability Director", "supervisor"),
            ("engineer@plantops.industrial", "Tenure2026!", "Senior Robotics Specialist", "technician"),
            ("demo@plantops.industrial", "Tenure2026!", "Site Operations Lead", "supervisor"),
        ]

        for email, pwd, full_name, role in demo_accounts:
            hashed = hash_password(pwd)
            cursor.execute("""
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    password_hash = excluded.password_hash,
                    full_name = excluded.full_name,
                    role = excluded.role
            """, (email, hashed, full_name, role))

        print(f" [OK] Seeded {len(demo_accounts)} operations accounts.")

        # ──────────────────────────────────────────────────────────
        # 2. Machines
        # ──────────────────────────────────────────────────────────
        machines = [
            (
                "ur5e-001",
                "Universal Robots UR5e — Cell A",
                "robot_arm",
                "Universal Robots UR5e (6-Axis)",
                "Cell A — High-Precision Deburring",
                5.0,
                850.0,
                "online",
                74.5,
                168.0,
            ),
            (
                "kuka-kr10",
                "KUKA KR 10 Cybertech — Bay 2",
                "robot_arm",
                "KUKA KR 10 R1420 (6-Axis)",
                "Bay 2 — Heavy Packaging & Stacking",
                10.0,
                1420.0,
                "online",
                61.0,
                92.0,
            ),
            (
                "fanuc-crx10",
                "FANUC CRX-10iA — Line 1",
                "robot_arm",
                "FANUC CRX-10iA Collaborative Robot",
                "Line 1 — End-of-Arm Assembly",
                10.0,
                1249.0,
                "online",
                52.0,
                48.0,
            ),
            (
                "abb-irb1200",
                "ABB IRB 1200-5/0.9 — Cell C",
                "robot_arm",
                "ABB IRB 1200 Compact Robot",
                "Cell C — High-Speed Material Transfer",
                5.0,
                901.0,
                "online",
                94.8,
                580.0,
            ),
        ]

        for m_id, name, m_type, model, loc, payload, reach, status, health, rul in machines:
            cursor.execute("""
                INSERT INTO machines (
                    machine_id, name, type, model, location, payload_kg, reach_mm,
                    status, health_score, rul_hours, manual_text
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(machine_id) DO UPDATE SET
                    name = excluded.name,
                    type = excluded.type,
                    model = excluded.model,
                    location = excluded.location,
                    payload_kg = excluded.payload_kg,
                    reach_mm = excluded.reach_mm,
                    status = excluded.status,
                    health_score = excluded.health_score,
                    rul_hours = excluded.rul_hours
            """, (
                m_id, name, m_type, model, loc, payload, reach,
                status, health, rul,
                f"Certified operations and maintenance manual for {name} ({model}). Reach: {reach}mm, Payload: {payload}kg.",
            ))

        print(f" [OK] Seeded {len(machines)} fleet robotic workcells.")

        # ──────────────────────────────────────────────────────────
        # 3. Technicians
        # ──────────────────────────────────────────────────────────
        techs = [
            (
                "tech-sarah-01",
                "Sarah Chen",
                "sarah.chen@plantops.industrial",
                "+1-555-0192",
                json.dumps(["robotics", "harmonic_drive", "servo", "kuka_krc4", "calibration", "thermal"]),
                12,
                "L3",
                "busy",
                "anm-active-ur5e",
                "day",
                "Bay 3 — Robotic Welding",
                0.98,
                2.0,
            ),
            (
                "tech-marcus-02",
                "Marcus Vance",
                "marcus.vance@plantops.industrial",
                "+1-555-0184",
                json.dumps(["robotics", "servo", "kuka_krc4", "fanuc_tp", "electrical", "thermal"]),
                8,
                "L2",
                "available",
                None,
                "day",
                "Plant Floor A",
                0.91,
                2.8,
            ),
            (
                "tech-dave-03",
                "Dave Miller",
                "dave.miller@plantops.industrial",
                "+1-555-0143",
                json.dumps(["robotics", "harmonic_drive", "lubrication"]),
                3,
                "L1",
                "available",
                None,
                "day",
                "Bay 4 — Palletizing",
                0.84,
                3.5,
            ),
            (
                "tech-elena-04",
                "Elena Rostova",
                "elena.rostova@plantops.industrial",
                "+1-555-0177",
                json.dumps(["electrical", "servo", "plc", "abb_rapid", "diagnostics"]),
                7,
                "L2",
                "off-shift",
                None,
                "evening",
                "Substation C",
                0.93,
                2.2,
            ),
            (
                "tech-rajesh-05",
                "Rajesh R",
                "rajesh.r@plantops.industrial",
                "+1-555-0165",
                json.dumps(["robotics", "pneumatics", "mechanical"]),
                4,
                "L1",
                "on-leave",
                None,
                "day",
                "Assembly Line B",
                0.86,
                3.0,
            ),
        ]

        for tid, name, email, phone, specs, exp, cert, avail, cur_task, shift, loc, s_rate, avg_hrs in techs:
            cursor.execute("""
                INSERT INTO technicians (
                    id, name, email, phone, specializations, experience_years,
                    certification_level, availability, current_task_id, shift,
                    location, success_rate, avg_repair_hours
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    email = excluded.email,
                    phone = excluded.phone,
                    specializations = excluded.specializations,
                    experience_years = excluded.experience_years,
                    certification_level = excluded.certification_level,
                    availability = excluded.availability,
                    current_task_id = excluded.current_task_id,
                    shift = excluded.shift,
                    location = excluded.location,
                    success_rate = excluded.success_rate,
                    avg_repair_hours = excluded.avg_repair_hours
            """, (tid, name, email, phone, specs, exp, cert, avail, cur_task, shift, loc, s_rate, avg_hrs))

        print(f" [OK] Seeded {len(techs)} certified technicians with dynamic availability.")

        # ──────────────────────────────────────────────────────────
        # 4. Vendors
        # ──────────────────────────────────────────────────────────
        vendors = [
            (
                "vend-apex",
                "Apex Industrial Automation",
                "orders@apexindustrial.corp",
                "+1-800-555-APEX",
                "#procure-apex-direct",
                json.dumps(["FANUC-A06B-0115", "UR-HD-J3-2026", "KK-SERV-A1-6"]),
                14,
                4.2,
            ),
            (
                "vend-motionpro",
                "MotionPro Solutions & Controls",
                "rapid-dispatch@motionpro.io",
                "+1-888-MOTION-PRO",
                "#procure-motionpro-priority",
                json.dumps(["FANUC-A06B-0115", "KK-CYCLO-J5", "FANUC-PULSE-CODER"]),
                1,
                4.9,
            ),
            (
                "vend-ur-apac",
                "Universal Robots Spares APAC",
                "spares@ur-apac.industrial",
                "+65-6800-URSP",
                "#procure-ur-apac",
                json.dumps(["UR-HD-J3-2026", "UR-SEAL-KIT", "UR-CTRL-CB4"]),
                2,
                4.8,
            ),
            (
                "vend-kuka-direct",
                "KUKA Robotics Parts Direct",
                "parts@kuka-direct.corp",
                "+49-821-797-0",
                "#procure-kuka-global",
                json.dumps(["KK-CYCLO-J5", "KK-SERV-A1-6"]),
                3,
                4.7,
            ),
        ]

        for vid, vname, vemail, vphone, vslack, vcat, lead, rating in vendors:
            cursor.execute("""
                INSERT INTO vendors (
                    id, name, contact_email, contact_phone, slack_channel, catalog, lead_time_days, rating
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    contact_email = excluded.contact_email,
                    contact_phone = excluded.contact_phone,
                    slack_channel = excluded.slack_channel,
                    catalog = excluded.catalog,
                    lead_time_days = excluded.lead_time_days,
                    rating = excluded.rating
            """, (vid, vname, vemail, vphone, vslack, vcat, lead, rating))

        print(f" [OK] Seeded {len(vendors)} industrial suppliers.")

        # ──────────────────────────────────────────────────────────
        # 5. Inventory
        # ──────────────────────────────────────────────────────────
        inventory = [
            (
                "part-ur5-01",
                "UR-HD-J3-2026",
                "Universal Robots Harmonic Drive Unit Joint 3",
                "Harmonic drive reduction gear with cross-roller bearing for UR5e Joint 3",
                "bearing",
                json.dumps(["ur5e-001"]),
                2,
                1,
                1850.00,
                "Bin-UR-04",
            ),
            (
                "part-ur5-02",
                "UR-SEAL-KIT",
                "Joint 2/3 Flange Nitrile Seal Kit",
                "Elastomer seals for harmonic drive oil retention",
                "seal",
                json.dumps(["ur5e-001"]),
                5,
                2,
                120.00,
                "Bin-UR-11",
            ),
            (
                "part-kuka-01",
                "KK-SERV-A1-6",
                "KUKA Synchronous AC Servo Motor (Axis 1/2)",
                "Brushless AC servo motor with multi-turn absolute encoder for KR 10",
                "servo",
                json.dumps(["kuka-kr10"]),
                1,
                1,
                2450.00,
                "Bin-KK-01",
            ),
            (
                "part-kuka-02",
                "KK-CYCLO-J5",
                "KUKA Precision Cycloidal Drive Unit (J5)",
                "Low-backlash cycloidal speed reducer for wrist joint 5",
                "bearing",
                json.dumps(["kuka-kr10"]),
                2,
                1,
                1980.00,
                "Bin-KK-05",
            ),
            (
                "part-fanuc-01",
                "FANUC-A06B-0115",
                "FANUC AC Servo Motor Alpha-i4/5000",
                "Sensorized AC brushless servo motor for FANUC CRX-10iA Joint 4 arm",
                "servo",
                json.dumps(["fanuc-crx10"]),
                0,  # CRITICAL: 0 INVENTORY TRIGGERS AUTONOMOUS MULTI-VENDOR CASCADE
                1,
                1420.00,
                "Bin-FN-04",
            ),
            (
                "part-fanuc-02",
                "FANUC-PULSE-CODER",
                "FANUC Absolute Optical Pulse Coder Alpha A1000",
                "High-resolution rotary encoder module",
                "encoder",
                json.dumps(["fanuc-crx10"]),
                3,
                1,
                580.00,
                "Bin-FN-09",
            ),
            (
                "part-abb-01",
                "ABB-SEAL-1200",
                "ABB Radial Shaft Seal Kit 1200",
                "Viton oil seals for ABB IRB 1200 gearboxes",
                "seal",
                json.dumps(["abb-irb1200"]),
                8,
                2,
                95.00,
                "Bin-ABB-02",
            ),
        ]

        for pid, pnum, pname, pdesc, pcat, pcomp, qty, reorder, cost, loc in inventory:
            cursor.execute("""
                INSERT INTO inventory_parts (
                    id, part_number, name, description, category,
                    compatible_machines, quantity_on_hand, reorder_threshold,
                    unit_cost_usd, location_bin
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(part_number) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    category = excluded.category,
                    compatible_machines = excluded.compatible_machines,
                    quantity_on_hand = excluded.quantity_on_hand,
                    reorder_threshold = excluded.reorder_threshold,
                    unit_cost_usd = excluded.unit_cost_usd,
                    location_bin = excluded.location_bin
            """, (pid, pnum, pname, pdesc, pcat, pcomp, qty, reorder, cost, loc))

        print(f" [OK] Seeded {len(inventory)} components into Central Inventory.")

        # ──────────────────────────────────────────────────────────
        # 6. Historical Repair Outcomes for UR5e (Recurrence Attribution)
        # ──────────────────────────────────────────────────────────
        past_repairs = [
            (
                "rep-ur5-001",
                "anm-ur5-past-1",
                "ur5e-001",
                "tech-dave-03",
                "lubrication",
                "joint_3_temp",
                "part-ur5-02",
                1,
                "failed",
                "Applied Kluberplex grease to Joint 3 flange. Thermal elevation returned within 14 operational hours.",
                "2026-08-10 09:30:00",
                "2026-08-10 14:00:00",
                "2026-08-11 04:00:00",
            ),
            (
                "rep-ur5-002",
                "anm-ur5-past-2",
                "ur5e-001",
                "tech-dave-03",
                "recalibration",
                "joint_3_torque",
                None,
                0,
                "failed",
                "Zeroed torque sensors and adjusted PID velocity feedforward. Backlash reappeared in cycle 420.",
                "2026-08-28 11:15:00",
                "2026-08-28 13:45:00",
                "2026-08-29 18:30:00",
            ),
            (
                "rep-ur5-003",
                "anm-ur5-past-3",
                "ur5e-001",
                "tech-marcus-02",
                "inspection",
                "joint_3_torque",
                None,
                0,
                "partial",
                "Tightened flexspline housing bolts to 12.5 Nm. Stabilized for 11 days then torque drift resumed.",
                "2026-09-12 08:00:00",
                "2026-09-12 11:30:00",
                "2026-09-23 09:15:00",
            ),
        ]

        for rid, anmid, mid, tid, act, fault, pid, pused, outc, notes, started, completed, rec_at in past_repairs:
            cursor.execute("""
                INSERT INTO repair_outcomes (
                    id, anomaly_id, machine_id, technician_id, action_taken,
                    fault_type, part_id, part_used, outcome, notes,
                    started_at, completed_at, recurrence_detected_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    outcome = excluded.outcome,
                    notes = excluded.notes,
                    recurrence_detected_at = excluded.recurrence_detected_at
            """, (rid, anmid, mid, tid, act, fault, pid, pused, outc, notes, started, completed, rec_at))

        print(f" [OK] Seeded {len(past_repairs)} historical repair records for UR5e recurrence reasoning.")

        conn.commit()

    print("\n[COMPLETE] Tenure Industrial Fleet & Operations initialization finished!")

if __name__ == "__main__":
    seed_industrial_fleet()
