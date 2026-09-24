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
"""

SEED_DATA = """
-- Seed the demo UR5e machine
INSERT OR IGNORE INTO machines (machine_id, name, type, install_date)
VALUES ('ur5e-001', 'UR5e Demo Unit', 'UR5e', '2025-01-15');
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
