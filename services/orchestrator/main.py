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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.init_db import get_connection
from services.rag_service.store import VectorStore
from services.orchestrator.gemini_client import GeminiTechnicianClient


# ──────────────────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    anomaly_id: str
    machine_id: str


class ChatRequest(BaseModel):
    machine_id: str
    message: str
    conversation_id: str | None = None


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

vector_store = VectorStore()
gemini_client = GeminiTechnicianClient()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "orchestrator"}


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

    anomaly_id, machine_id, ts, flagged_json, dev_json, severity = row
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
    conv_id = payload.conversation_id or str(uuid.uuid4())

    # Retrieve context
    citations = vector_store.search(
        query=payload.message,
        machine_id=payload.machine_id,
        top_k=3,
    )

    # Generate response
    reply_res = gemini_client.generate_chat_response(
        machine_id=payload.machine_id,
        user_message=payload.message,
        citations=citations,
    )

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

            cursor.execute(
                """
                INSERT INTO conversation_logs (id, anomaly_id, machine_id, messages)
                VALUES (?, '', ?, ?)
                ON CONFLICT(id) DO UPDATE SET messages = excluded.messages
                """,
                (conv_id, payload.machine_id, json.dumps(msgs)),
            )
            conn.commit()
    except Exception as e:
        print(f"[orchestrator] Could not update conversation log: {e}")

    return {
        "conversation_id": conv_id,
        "machine_id": payload.machine_id,
        "reply": reply_res["reply"],
        "citations": citations,
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
        "status": "recorded",
        "feedback_id": feedback_id,
        "outcome": payload.outcome,
        "continuous_learning_updated": payload.outcome == "corrected",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.orchestrator.main:app", host="0.0.0.0", port=8000, reload=True)
