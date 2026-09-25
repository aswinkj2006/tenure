"""
Tenure — Database schema and initialization.

Uses SQLite for the hackathon. Tables match the data model from project.md.
"""

import sqlite3
import os
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).parent / "tenure.db"


SCHEMA = """
-- Machines registered in the system
CREATE TABLE IF NOT EXISTS machines (
    machine_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    install_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Streaming sensor data from ProtoTwin sim
CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    ts TEXT NOT NULL,
    sensor_name TEXT NOT NULL,
    value REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_machine_ts
    ON sensor_readings(machine_id, ts);

-- Anomalies flagged by the anomaly detection service
CREATE TABLE IF NOT EXISTS anomaly_records (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    ts TEXT NOT NULL,
    flagged_sensors TEXT NOT NULL,          -- JSON array of sensor names
    deviation_magnitude TEXT NOT NULL,      -- JSON object {sensor: magnitude}
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_anomaly_records_machine
    ON anomaly_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_records_severity
    ON anomaly_records(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_records_status
    ON anomaly_records(status);

-- LLM diagnoses linked to anomalies
CREATE TABLE IF NOT EXISTS diagnoses (
    id TEXT PRIMARY KEY,
    anomaly_id TEXT NOT NULL REFERENCES anomaly_records(id),
    llm_output TEXT NOT NULL,
    citations TEXT NOT NULL,               -- JSON array of citation objects
    confidence REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Human feedback on diagnoses (append-only!)
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    diagnosis_id TEXT NOT NULL REFERENCES diagnoses(id),
    outcome TEXT NOT NULL CHECK (outcome IN ('confirmed', 'corrected')),
    confirmed_cause TEXT,                   -- only populated if outcome='corrected'
    ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Full conversation logs per anomaly issue (append-only!)
CREATE TABLE IF NOT EXISTS conversation_logs (
    id TEXT PRIMARY KEY,
    anomaly_id TEXT NOT NULL REFERENCES anomaly_records(id),
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    messages TEXT NOT NULL DEFAULT '[]',    -- JSON array of message objects
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_machine
    ON conversation_logs(machine_id);

-- Vector document metadata (actual embeddings live in Chroma/Qdrant)
CREATE TABLE IF NOT EXISTS vector_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    doc_type TEXT NOT NULL CHECK (doc_type IN ('manual', 'incident', 'feedback')),
    chunk_text TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vector_documents_machine
    ON vector_documents(machine_id);

-- Registered application users with salted password hashing
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'technician',
    full_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pinned analytical charts for fleet dashboard
CREATE TABLE IF NOT EXISTS pinned_charts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    machine_id TEXT,
    title TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    chart_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ──────────────────────────────────────────────────────────
-- Technician workforce management
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    specializations TEXT NOT NULL DEFAULT '[]',  -- JSON array: ['hydraulics','electrical','robotics']
    experience_years INTEGER NOT NULL DEFAULT 0,
    certification_level TEXT NOT NULL DEFAULT 'L1' CHECK (certification_level IN ('L1','L2','L3','Senior','Expert')),
    availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','busy','off-shift','on-leave')),
    current_task_id TEXT,                          -- anomaly_id they are currently handling
    shift TEXT NOT NULL DEFAULT 'day' CHECK (shift IN ('day','evening','night')),
    location TEXT NOT NULL DEFAULT 'Plant Floor A',
    success_rate REAL NOT NULL DEFAULT 0.90,       -- historical repair success rate 0-1
    avg_repair_hours REAL NOT NULL DEFAULT 2.5,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Technician dispatch assignments
CREATE TABLE IF NOT EXISTS dispatch_assignments (
    id TEXT PRIMARY KEY,
    anomaly_id TEXT NOT NULL REFERENCES anomaly_records(id),
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    technician_id TEXT NOT NULL REFERENCES technicians(id),
    rank_score REAL NOT NULL,                      -- computed composite ranking score
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'dispatched' CHECK (status IN ('dispatched','in-progress','completed','reassigned')),
    notes TEXT,
    estimated_hours REAL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dispatch_anomaly ON dispatch_assignments(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_technician ON dispatch_assignments(technician_id);

-- ──────────────────────────────────────────────────────────
-- Parts inventory and vendor procurement
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_parts (
    id TEXT PRIMARY KEY,
    part_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,                        -- e.g. 'servo','bearing','seal','cable'
    compatible_machines TEXT NOT NULL DEFAULT '[]', -- JSON array of machine_ids
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    reorder_threshold INTEGER NOT NULL DEFAULT 2,
    unit_cost_usd REAL NOT NULL DEFAULT 0.0,
    location_bin TEXT,                             -- shelf/bin location in warehouse
    last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_part_number ON inventory_parts(part_number);

CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    slack_channel TEXT,                            -- Slack channel for automated orders
    catalog TEXT NOT NULL DEFAULT '[]',            -- JSON array of part_numbers they supply
    lead_time_days INTEGER NOT NULL DEFAULT 3,
    rating REAL NOT NULL DEFAULT 4.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS procurement_orders (
    id TEXT PRIMARY KEY,
    anomaly_id TEXT REFERENCES anomaly_records(id),
    part_id TEXT NOT NULL REFERENCES inventory_parts(id),
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','slack_sent','confirmed','shipped','delivered','cancelled')),
    slack_message_ts TEXT,                         -- Slack message timestamp for threading
    slack_channel TEXT,
    requested_by TEXT,
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    estimated_arrival TEXT,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_procurement_anomaly ON procurement_orders(anomaly_id);

-- ──────────────────────────────────────────────────────────
-- Recurrence Intelligence & xAI Attribution
-- ──────────────────────────────────────────────────────────

-- Tracks actual repair outcomes: did the fix hold or did the same fault return?
CREATE TABLE IF NOT EXISTS repair_outcomes (
    id TEXT PRIMARY KEY,
    dispatch_id TEXT NOT NULL REFERENCES dispatch_assignments(id),
    anomaly_id TEXT NOT NULL REFERENCES anomaly_records(id),
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    technician_id TEXT NOT NULL REFERENCES technicians(id),
    fault_signature TEXT NOT NULL,          -- JSON sorted list of flagged sensors (canonical key)
    outcome TEXT NOT NULL CHECK (outcome IN ('resolved', 'recurred', 'partial', 'unknown')),
    recurrence_count INTEGER NOT NULL DEFAULT 0, -- how many times this exact fault has recurred
    resolved_at TEXT,
    recurred_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_repair_outcomes_machine ON repair_outcomes(machine_id);
CREATE INDEX IF NOT EXISTS idx_repair_outcomes_signature ON repair_outcomes(fault_signature);

-- Stores structured xAI reasoning traces for recurrence decisions
CREATE TABLE IF NOT EXISTS fault_attribution_log (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    anomaly_id TEXT NOT NULL,
    fault_signature TEXT NOT NULL,
    recurrence_count INTEGER NOT NULL DEFAULT 0,
    attribution TEXT NOT NULL CHECK (attribution IN ('machine_fault', 'technician_skill_gap', 'ambiguous', 'systemic')),
    confidence REAL NOT NULL,               -- 0.0 – 1.0
    reasoning_chain TEXT NOT NULL,          -- JSON array of reasoning steps
    evidence TEXT NOT NULL DEFAULT '{}',    -- JSON evidence dict
    excluded_technicians TEXT NOT NULL DEFAULT '[]', -- JSON list of tech IDs excluded from re-dispatch
    recommended_action TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attribution_machine ON fault_attribution_log(machine_id);
CREATE INDEX IF NOT EXISTS idx_attribution_signature ON fault_attribution_log(fault_signature);
"""

SEED_DATA = """
-- Seed the demo UR5e machine
INSERT OR IGNORE INTO machines (machine_id, name, type, install_date)
VALUES ('ur5e-001', 'UR5e Demo Unit', 'UR5e', '2025-01-15');

-- Seed a second machine for vendor procurement demo
INSERT OR IGNORE INTO machines (machine_id, name, type, install_date)
VALUES ('kuka-kr10-002', 'KUKA KR10 R1100 sixx', 'KUKA_KR10', '2024-09-03');

-- Seed default operator personas with PBKDF2 hashed password 'password123'
-- Hash of 'password123' with salt 'tenure_salt_2026'
INSERT OR IGNORE INTO users (id, username, password_hash, salt, role, full_name)
VALUES 
('user-tech-01', 'dave.miller@plantops.industrial', '585ce09c5bc8005391e4fe6f2ec52e460627e46e7f22ddcfc37956eb628e83f0', 'tenure_salt_2026', 'Lead Mechatronics Technician', 'Dave Miller'),
('user-lead-02', 'sarah.lin@plantops.industrial', '585ce09c5bc8005391e4fe6f2ec52e460627e46e7f22ddcfc37956eb628e83f0', 'tenure_salt_2026', 'Plant Reliability Overseer', 'Sarah Lin');

-- ── Technician workforce seed ──
INSERT OR IGNORE INTO technicians (id, name, email, phone, specializations, experience_years, certification_level, availability, shift, location, success_rate, avg_repair_hours)
VALUES
  ('tech-001', 'Arjun Mehta',    'arjun.mehta@plantops.industrial',   '+91-98451-10021', '["robotics","servo","harmonic_drive"]',   9, 'Expert',  'available',  'day',     'Plant Floor A', 0.97, 1.8),
  ('tech-002', 'Priya Nair',     'priya.nair@plantops.industrial',    '+91-98451-10022', '["electrical","plc","vision"]',           7, 'Senior',  'available',  'day',     'Plant Floor B', 0.94, 2.1),
  ('tech-003', 'Rohan Das',      'rohan.das@plantops.industrial',     '+91-98451-10023', '["hydraulics","pneumatics","seals"]',     5, 'L3',      'busy',       'day',     'Plant Floor A', 0.89, 2.8),
  ('tech-004', 'Selin Yildiz',   'selin.yildiz@plantops.industrial',  '+91-98451-10024', '["robotics","calibration","welding"]',    11,'Expert',  'off-shift',  'evening', 'Bay 3',         0.98, 1.5),
  ('tech-005', 'Marcus Webb',    'marcus.webb@plantops.industrial',   '+91-98451-10025', '["electrical","servo","plc"]',            6, 'L3',      'available',  'night',   'Plant Floor C', 0.91, 2.4),
  ('tech-006', 'Aiko Tanaka',    'aiko.tanaka@plantops.industrial',   '+91-98451-10026', '["robotics","vision","harmonic_drive"]',  8, 'Senior',  'on-leave',   'day',     'Plant Floor A', 0.95, 2.0);

-- ── Inventory parts seed ──
INSERT OR IGNORE INTO inventory_parts (id, part_number, name, description, category, compatible_machines, quantity_on_hand, reorder_threshold, unit_cost_usd, location_bin)
VALUES
  ('part-001', 'UR-HD-J3-2026',  'Harmonic Drive Assembly (J3)',   'Joint 3 harmonic drive gear set for UR5e — rated 150 Nm', 'harmonic_drive', '["ur5e-001"]',          0,  2, 1240.00, 'W-A-03'),
  ('part-002', 'UR-ENC-ABS-X',   'Absolute Encoder Module',        'Heidenhain absolute encoder, 23-bit, TTL', 'encoder',       '["ur5e-001","kuka-kr10-002"]', 3,  2,  380.00, 'W-B-11'),
  ('part-003', 'UR-SEAL-J2-KIT', 'Joint 2 Oil Seal Kit',           'Viton O-ring + lip seal kit for joint 2 oil retention', 'seal',           '["ur5e-001"]',          7,  3,   65.00, 'W-A-07'),
  ('part-004', 'UR-BRAKE-J1',    'Joint 1 Electromagnetic Brake',  'Spring-loaded EM brake assembly, 24V DC, fail-safe', 'brake',          '["ur5e-001"]',          1,  2,  890.00, 'W-C-02'),
  ('part-005', 'UR-CABLE-12M',   'Robot Cable Harness 12m',        'Complete 12-metre signal + power cable harness', 'cable',           '["ur5e-001","kuka-kr10-002"]', 4,  2,  220.00, 'W-D-01'),
  ('part-006', 'KK-SERV-A1-6',   'KUKA A1 Servo Motor (KR10)',     'Fanuc-compatible servo for KUKA KR10 axis 1', 'servo',           '["kuka-kr10-002"]',      0,  1, 2100.00, 'W-E-04'),
  ('part-007', 'GEN-BEAR-6205',  'Deep Groove Ball Bearing 6205',  'NSK 6205-2RS, ID=25mm, OD=52mm, B=15mm', 'bearing',         '["ur5e-001","kuka-kr10-002"]', 12, 4,   18.00, 'W-F-09'),
  ('part-008', 'UR-CTRL-CB4',    'UR Control Box CB4 PCB',         'Main controller PCB for UR CB4 series', 'controller',      '["ur5e-001"]',          1,  1, 4200.00, 'W-G-01');

-- ── Vendor seed ──
INSERT OR IGNORE INTO vendors (id, name, contact_email, contact_phone, slack_channel, catalog, lead_time_days, rating)
VALUES
  ('vend-001', 'Universal Robots Spares APAC', 'spares.apac@universal-robots.com', '+65-6709-8200', '#vendor-ur-spares',   '["UR-HD-J3-2026","UR-ENC-ABS-X","UR-SEAL-J2-KIT","UR-BRAKE-J1","UR-CABLE-12M","UR-CTRL-CB4"]', 3, 4.8),
  ('vend-002', 'KUKA Robotics Parts India',    'parts.india@kuka.com',             '+91-80-4116-5000','#vendor-kuka-parts', '["KK-SERV-A1-6","GEN-BEAR-6205","UR-ENC-ABS-X","UR-CABLE-12M"]',                            5, 4.5),
  ('vend-003', 'IndusMotion Component Store',  'orders@indusmotion.in',            '+91-44-2815-9100','#vendor-indusmotion','["GEN-BEAR-6205","UR-SEAL-J2-KIT","UR-CABLE-12M","UR-BRAKE-J1"]',                           2, 4.2);
"""


def init_db(db_path: str | Path | None = None) -> sqlite3.Connection:
    """Initialize the database with schema and seed data."""
    path = Path(db_path) if db_path else DB_PATH
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(SCHEMA)
    conn.executescript(SEED_DATA)
    conn.commit()
    print(f"[db] Initialized database at {path}")
    return conn


def get_connection(db_path: str | Path | None = None) -> sqlite3.Connection:
    """Get a connection to the database, creating it if needed."""
    path = Path(db_path) if db_path else DB_PATH
    if not path.exists():
        return init_db(path)
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


if __name__ == "__main__":
    conn = init_db()
    # Verify
    cursor = conn.execute("SELECT * FROM machines")
    rows = cursor.fetchall()
    print(f"[db] Machines: {rows}")
    conn.close()
    print("[db] Done.")
