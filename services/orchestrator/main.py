"""
Tenure — Orchestrator Service

FastAPI server that:
  1. Handles /diagnose — combines anomaly telemetry with RAG manual chunks and calls Gemini
  2. Handles /chat — conversational Q&A cited from technical documentation
  3. Handles /feedback — logs technician confirmation/corrections and re-indexes corrections
     into the vector store for continuous learning

Port: 8000
"""

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.init_db import get_connection
from services.rag_service.store import VectorStore
from services.orchestrator.gemini_client import GeminiTechnicianClient
from services.orchestrator.logs_module import (
    query_logs,
    get_issue_detail,
    generate_csv_export,
    generate_pdf_report,
)



# ──────────────────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    anomaly_id: str
    machine_id: str | None = None


class ChatRequest(BaseModel):
    machine_id: str | None = "ur5e-001"
    message: str
    conversation_id: str | None = None
    anomaly_id: str | None = None


class FeedbackRequest(BaseModel):
    diagnosis_id: str
    outcome: str  # 'confirmed' | 'corrected'
    confirmed_cause: str | None = None


app = FastAPI(
    title="Tenure Orchestrator",
    description="LLM reasoning engine, cited diagnostics, and continuous feedback learning loop.",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────
# Digital Twin Web UI
# ──────────────────────────────────────────────────────────
web_twin_path = Path(__file__).parent.parent.parent / "web_twin"
if web_twin_path.exists():
    app.mount("/twin", StaticFiles(directory=str(web_twin_path), html=True), name="twin")

    @app.get("/")
    async def root_redirect():
        return RedirectResponse(url="/twin/")

vector_store = VectorStore()
gemini_client = GeminiTechnicianClient()


def generate_chart_data(user_message: str, machine_id: str) -> dict[str, Any] | None:
    """Detect chart/trend intent and formulate structured time-series data."""
    lower = user_message.lower()
    keywords = ["chart", "plot", "trend", "graph", "history", "profile", "timeline", "over time"]
    if not any(k in lower for k in keywords):
        return None

    sensor = "joint_3_torque"
    title = "Joint 3 Torque Trend"
    y_label = "Torque (Nm)"
    for j in range(1, 7):
        if f"joint {j}" in lower or f"joint_{j}" in lower or f"j{j}" in lower:
            if "vel" in lower:
                sensor = f"joint_{j}_velocity"
                title = f"Joint {j} Velocity Trend"
                y_label = "Velocity (rad/s)"
            elif "pos" in lower:
                sensor = f"joint_{j}_position"
                title = f"Joint {j} Position Trend"
                y_label = "Position (rad)"
            else:
                sensor = f"joint_{j}_torque"
                title = f"Joint {j} Torque Trend"
                y_label = "Torque (Nm)"
            break

    points = []
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT ts, value
                FROM sensor_readings
                WHERE machine_id = ? AND sensor_name = ?
                ORDER BY id DESC
                LIMIT 20
                """,
                (machine_id, sensor),
            )
            db_rows = cursor.fetchall()

        if db_rows and len(db_rows) >= 5:
            for r in reversed(db_rows):
                points.append({"x": r[0], "y": round(float(r[1]), 2)})
    except Exception as e:
        print(f"[orchestrator] Could not query sensor_readings: {e}")

    if not points:
        import math
        now = datetime.now(timezone.utc)
        for i in range(12, 0, -1):
            t = now.timestamp() - (i * 300)
            iso = datetime.fromtimestamp(t, tz=timezone.utc).isoformat()
            val = 25.0 + 8.0 * math.sin(i * 0.5)
            if "velocity" in sensor:
                val = 0.2 + 0.1 * math.sin(i * 0.5)
            elif "position" in sensor:
                val = 1.0 + 0.5 * math.sin(i * 0.5)
            points.append({"x": iso, "y": round(val, 2)})

    return {
        "chart_type": "line",
        "title": title,
        "x_label": "Time",
        "y_label": y_label,
        "series": [
            {
                "name": title,
                "data": points,
            }
        ],
        "pin_to_dashboard": False,
    }


def compute_fleet_summary():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM machines")
        total_machines = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM anomaly_records WHERE status = 'open'")
        active_alerts = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM anomaly_records WHERE created_at >= datetime('now', '-1 day')")
        issues_last_24h = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM anomaly_records WHERE status = 'resolved' AND created_at >= datetime('now', '-1 day')")
        issues_resolved_24h = cursor.fetchone()[0]

        # Calculate avg health score
        cursor.execute("SELECT severity, COUNT(*) FROM anomaly_records WHERE status = 'open' GROUP BY severity")
        sev_counts = dict(cursor.fetchall())
        penalty = (
            sev_counts.get("critical", 0) * 25.0
            + sev_counts.get("high", 0) * 15.0
            + sev_counts.get("medium", 0) * 8.0
            + sev_counts.get("low", 0) * 3.0
        )
        avg_health = max(10.0, min(100.0, 100.0 - penalty))

        # Machines list
        cursor.execute("SELECT machine_id, name, type, install_date FROM machines")
        m_rows = cursor.fetchall()

        machines = []
        for m in m_rows:
            cursor.execute(
                "SELECT COUNT(*) FROM anomaly_records WHERE machine_id = ? AND status = 'open'",
                (m[0],),
            )
            m_alerts = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(*), MAX(ts) FROM anomaly_records WHERE machine_id = ?",
                (m[0],),
            )
            m_issue_stats = cursor.fetchone()
            total_issues = m_issue_stats[0] if m_issue_stats else 0
            last_anomaly_at = m_issue_stats[1] if m_issue_stats else None

            machines.append({
                "machine_id": m[0],
                "name": m[1],
                "type": m[2],
                "install_date": m[3],
                "status": "online",
                "health_score": round(avg_health, 1),
                "active_alerts": m_alerts,
                "total_issues": total_issues,
                "last_anomaly_at": last_anomaly_at,
            })

    return {
        "total_machines": max(total_machines, 1),
        "machines_online": max(total_machines, 1),
        "active_alerts": active_alerts,
        "avg_health_score": round(avg_health, 1),
        "issues_last_24h": issues_last_24h,
        "issues_resolved_last_24h": issues_resolved_24h,
        "machines": machines,
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "orchestrator"}


@app.get("/machines")
async def list_machines():
    summary = compute_fleet_summary()
    return {"machines": summary["machines"]}


@app.get("/machines/{machine_id}")
async def get_machine(machine_id: str):
    summary = compute_fleet_summary()
    for m in summary["machines"]:
        if m["machine_id"] == machine_id:
            return m
    raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found")


@app.get("/dashboard/summary")
async def dashboard_summary():
    return compute_fleet_summary()


@app.get("/fleet/overview")
async def fleet_overview():
    return compute_fleet_summary()


@app.post("/diagnose")
async def diagnose_anomaly(payload: DiagnoseRequest):
    """
    Given an anomaly_id, fetch telemetry details from anomaly_records,
    retrieve pertinent manufacturer manual sections, query Gemini,
    record the diagnosis in SQLite, and return the cited response.
    """
    # 1. Fetch anomaly record from DB
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, machine_id, ts, flagged_sensors, deviation_magnitude, severity
            FROM anomaly_records
            WHERE id = ?
            """,
            (payload.anomaly_id,),
        )
        row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Anomaly record {payload.anomaly_id} not found")

    anomaly_id, rec_machine_id, ts, flagged_json, dev_json, severity = row
    machine_id = payload.machine_id or rec_machine_id
    flagged_sensors = json.loads(flagged_json) if flagged_json else []
    deviation_magnitude = json.loads(dev_json) if dev_json else {}

    # 2. Formulate query for RAG
    query_terms = [f"{s} error troubleshooting maintenance" for s in flagged_sensors]
    search_query = f"UR5e {severity} anomaly: " + " ".join(query_terms)

    # 3. Retrieve relevant chunks
    citations = vector_store.search(
        query=search_query,
        machine_id=machine_id,
        top_k=4,
    )

    # 4. Generate diagnosis via Gemini
    diagnosis_res = gemini_client.generate_diagnosis(
        machine_id=machine_id,
        flagged_sensors=flagged_sensors,
        deviation_magnitude=deviation_magnitude,
        severity=severity,
        citations=citations,
    )

    diagnosis_id = str(uuid.uuid4())
    llm_output = diagnosis_res["llm_output"]
    confidence = diagnosis_res["confidence"]

    # 5. Persist to diagnoses table
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO diagnoses (id, anomaly_id, llm_output, citations, confidence)
            VALUES (?, ?, ?, ?, ?)
            """,
            (diagnosis_id, anomaly_id, llm_output, json.dumps(citations), confidence),
        )
        conn.commit()

    return {
        "diagnosis_id": diagnosis_id,
        "anomaly_id": anomaly_id,
        "machine_id": machine_id,
        "severity": severity,
        "diagnosis": llm_output,
        "llm_output": llm_output,
        "citations": citations,
        "confidence": confidence,
        "model": diagnosis_res.get("model", "unknown"),
    }


@app.post("/chat")
async def chat(payload: ChatRequest):
    """
    Conversational assistant for machinery questions, strictly grounded in documentation chunks.
    """
    target_machine = payload.machine_id or "ur5e-001"
    conv_id = payload.conversation_id or str(uuid.uuid4())

    # Retrieve context
    citations = vector_store.search(
        query=payload.message,
        machine_id=target_machine,
        top_k=3,
    )

    # Generate response
    reply_res = gemini_client.generate_chat_response(
        machine_id=target_machine,
        user_message=payload.message,
        citations=citations,
    )

    chart_data = generate_chart_data(payload.message, target_machine)

    # Append to conversation_logs
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT messages FROM conversation_logs WHERE id = ?", (conv_id,))
            row = cursor.fetchone()
            if row:
                msgs = json.loads(row[0])
            else:
                msgs = []

            msgs.append({"role": "user", "content": payload.message, "ts": datetime.now(timezone.utc).isoformat()})
            msgs.append({"role": "assistant", "content": reply_res["reply"], "citations": citations, "ts": datetime.now(timezone.utc).isoformat()})

            target_anomaly_id = payload.anomaly_id if payload.anomaly_id else None
            cursor.execute(
                """
                INSERT INTO conversation_logs (id, anomaly_id, machine_id, messages)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET messages = excluded.messages
                """,
                (conv_id, target_anomaly_id, target_machine, json.dumps(msgs)),
            )
            conn.commit()
    except Exception as e:
        print(f"[orchestrator] Could not update conversation log: {e}")

    return {
        "conversation_id": conv_id,
        "machine_id": target_machine,
        "anomaly_id": payload.anomaly_id,
        "reply": reply_res["reply"],
        "response": reply_res["reply"],
        "citations": citations,
        "chart_data": chart_data,
        "model": reply_res.get("model"),
    }


@app.post("/feedback")
async def submit_feedback(payload: FeedbackRequest):
    """
    Submit technician feedback on a diagnosis.
    If 'corrected', the verified cause is ingested back into the vector store
    as a high-relevance 'feedback' document for continuous learning.
    """
    if payload.outcome not in ("confirmed", "corrected"):
        raise HTTPException(status_code=400, detail="Outcome must be 'confirmed' or 'corrected'")

    feedback_id = str(uuid.uuid4())

    # 1. Fetch machine_id associated with diagnosis
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT d.id, a.machine_id, a.flagged_sensors, d.llm_output
            FROM diagnoses d
            JOIN anomaly_records a ON d.anomaly_id = a.id
            WHERE d.id = ?
            """,
            (payload.diagnosis_id,),
        )
        row = cursor.fetchone()

    machine_id = row[1] if row else "ur5e-001"

    # 2. Record feedback
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO feedback (id, diagnosis_id, outcome, confirmed_cause)
            VALUES (?, ?, ?, ?)
            """,
            (feedback_id, payload.diagnosis_id, payload.outcome, payload.confirmed_cause),
        )
        conn.commit()

    # 3. Continuous Learning: Ingest correction into vector store
    if payload.outcome == "corrected" and payload.confirmed_cause:
        learned_chunk = {
            "text": f"VERIFIED TECHNICIAN RESOLUTION for {machine_id}: {payload.confirmed_cause}. (Ref diagnosis {payload.diagnosis_id})",
            "source_ref": f"Technician_Correction_{feedback_id[:8]}",
            "section": "Human-in-the-Loop Feedback",
        }
        vector_store.ingest_chunks(
            machine_id=machine_id,
            chunks=[learned_chunk],
            doc_type="feedback",
        )
        print(f"[orchestrator] 🧠 Continuous learning: Ingested technician correction into vector store!")

    return {
        "status": "ok",
        "feedback_id": feedback_id,
        "outcome": payload.outcome,
        "continuous_learning_updated": payload.outcome == "corrected",
    }


# ──────────────────────────────────────────────────────────
# Logs & Audit Trail Endpoints
# ──────────────────────────────────────────────────────────

@app.get("/logs")
async def get_logs(
    machine_id: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    outcome: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    search: str | None = None,
    q: str | None = None,
    page: int | None = None,
    per_page: int | None = None,
    limit: int = 50,
    offset: int = 0,
):
    search_term = q or search
    actual_limit = per_page if per_page is not None else limit
    actual_offset = ((page - 1) * actual_limit) if (page is not None and page > 0) else offset

    return query_logs(
        machine_id=machine_id,
        severity=severity,
        status=status,
        outcome=outcome,
        from_date=from_date,
        to_date=to_date,
        search=search_term,
        limit=actual_limit,
        offset=actual_offset,
    )


@app.get("/logs/export/csv")
async def export_logs_csv(
    machine_id: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    outcome: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    search: str | None = None,
    q: str | None = None,
):
    search_term = q or search
    res = query_logs(
        machine_id=machine_id,
        severity=severity,
        status=status,
        outcome=outcome,
        from_date=from_date,
        to_date=to_date,
        search=search_term,
        limit=1000,
        offset=0,
    )
    csv_data = generate_csv_export(res["issues"])
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tenure_audit_logs.csv"},
    )


@app.get("/logs/export/pdf/{anomaly_id}")
@app.get("/logs/{anomaly_id}/export/pdf")
async def export_log_pdf(anomaly_id: str):
    try:
        pdf_bytes = generate_pdf_report(anomaly_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=tenure_incident_{anomaly_id}.pdf"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {e}")


@app.get("/logs/{anomaly_id}")
async def get_log_detail(anomaly_id: str):
    detail = get_issue_detail(anomaly_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Anomaly {anomaly_id} not found")
    return detail


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.orchestrator.main:app", host="0.0.0.0", port=8000, reload=True)
