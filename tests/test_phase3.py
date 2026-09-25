"""
Tenure — Phase 3 Verification Tests

Tests:
1. VectorStore ingestion and similarity retrieval
2. Document extraction and chunking
3. RAG service API endpoints (/ingest, /retrieve, /documents)
4. Orchestrator service endpoints (/diagnose, /chat, /feedback with continuous learning)
"""

import json
import pytest
from httpx import AsyncClient, ASGITransport

from db.init_db import init_db, get_connection
from services.rag_service.store import VectorStore
from services.rag_service.extractor import extract_text_from_bytes, chunk_document
from services.rag_service.main import app as rag_app
from services.orchestrator.main import app as orchestrator_app


@pytest.fixture(scope="module", autouse=True)
def setup_test_environment():
    init_db()


def test_document_extraction_and_chunking():
    """Verify markdown/text is split into chunks with source references."""
    sample_text = b"""# UR5e Joint Specifications
Joint 1, 2, and 3 have a maximum torque limit of 150.0 Nm.
Joint 4, 5, and 6 have a maximum torque limit of 28.0 Nm.

# Maintenance Procedures
If torque exceeds standard ratings, inspect mechanical linkages and check for harmonic drive friction.
"""
    sections = extract_text_from_bytes(sample_text, "ur5e_manual.md")
    assert len(sections) >= 1

    chunks = chunk_document(sections, filename="ur5e_manual.md", chunk_size=200, overlap=50)
    assert len(chunks) >= 1
    assert "ur5e_manual.md" in chunks[0]["source_ref"]
    assert "torque" in chunks[0]["text"].lower()


def test_vector_store_ingest_and_search():
    """Verify VectorStore stores and retrieves matching chunks."""
    store = VectorStore()
    test_chunks = [
        {
            "text": "Joint 3 harmonic drive requires inspection if torque exceeds 150 Nm.",
            "source_ref": "UR5e_Service_Guide.pdf#page=12",
            "section": "Joint 3 Maintenance",
        },
        {
            "text": "Payload capacity of UR5e is 5kg with a reach of 850mm.",
            "source_ref": "UR5e_Specs.pdf#page=2",
            "section": "Technical Specifications",
        },
    ]

    added = store.ingest_chunks("ur5e-001", test_chunks, doc_type="manual")
    assert added == 2

    # Query for torque
    results = store.search("harmonic drive torque inspection", "ur5e-001", top_k=2)
    assert len(results) > 0
    assert any("Joint 3" in r["chunk_text"] for r in results)


@pytest.mark.asyncio
async def test_rag_service_endpoints():
    """Verify /ingest, /retrieve, and /documents in rag_service."""
    transport = ASGITransport(app=rag_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Ingest a markdown file
        sample_doc = b"Joint 3 error code 410: Harmonic drive thermal spike or mechanical overload."
        files = {"file": ("manual.txt", sample_doc, "text/plain")}
        data = {"machine_id": "ur5e-001", "doc_type": "manual"}

        res = await ac.post("/ingest", data=data, files=files)
        assert res.status_code == 200
        assert res.json()["status"] == "ingested"

        # Retrieve
        res = await ac.post(
            "/retrieve",
            json={"query": "error code 410 harmonic drive", "machine_id": "ur5e-001", "top_k": 2},
        )
        assert res.status_code == 200
        chunks = res.json()["chunks"]
        assert len(chunks) > 0

        # List documents
        res = await ac.get("/documents/ur5e-001")
        assert res.status_code == 200
        assert res.json()["total_chunks"] > 0


@pytest.mark.asyncio
async def test_orchestrator_diagnose_chat_feedback():
    """Verify /diagnose, /chat, and continuous learning /feedback in orchestrator."""
    # First insert a test anomaly record into DB
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO anomaly_records
            (id, machine_id, ts, flagged_sensors, deviation_magnitude, severity, status)
            VALUES ('test-anomaly-p3', 'ur5e-001', '2026-09-25T01:00:00Z',
                    '["joint_3_torque"]', '{"joint_3_torque": 35.0}', 'high', 'open')
            """
        )
        conn.commit()

    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. /diagnose
        res = await ac.post("/diagnose", json={"anomaly_id": "test-anomaly-p3", "machine_id": "ur5e-001"})
        assert res.status_code == 200
        diag = res.json()
        assert "llm_output" in diag
        assert diag["severity"] == "high"
        diagnosis_id = diag["diagnosis_id"]

        # Check DB diagnoses table
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, llm_output FROM diagnoses WHERE id = ?", (diagnosis_id,))
            row = cursor.fetchone()
            assert row is not None

        # 2. /chat
        res = await ac.post(
            "/chat",
            json={"machine_id": "ur5e-001", "message": "What is the rated torque for joint 3?"},
        )
        assert res.status_code == 200
        chat_data = res.json()
        assert "reply" in chat_data

        # 3. /feedback - Technician correction with continuous learning
        res = await ac.post(
            "/feedback",
            json={
                "diagnosis_id": diagnosis_id,
                "outcome": "corrected",
                "confirmed_cause": "Loose mounting bolt on joint 3 gearbox flange caused false torque reading.",
            },
        )
        assert res.status_code == 200
        fb_data = res.json()
        assert fb_data["status"] in ("recorded", "ok")
        assert fb_data["continuous_learning_updated"] is True

        # Verify feedback was written to DB
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT outcome, confirmed_cause FROM feedback WHERE diagnosis_id = ?", (diagnosis_id,))
            fb_row = cursor.fetchone()
            assert fb_row is not None
            assert fb_row[0] == "corrected"
