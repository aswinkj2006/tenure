"""
Tenure — Phase 5 & 6 Verification Tests

Tests:
1. Logs querying with multi-criteria filters (severity, status, outcome, search, pagination)
2. Incident detail audit trail joining anomaly, diagnosis, citations, feedback, and conversation
3. CSV audit export (RFC-4180 compliant)
4. PDF incident audit report generation
5. Fleet dashboard summary metrics and machine overview
6. Machines list and individual machine detail
7. Chatbot chart intent detection for time-series trends
"""

import json
import pytest
from httpx import AsyncClient, ASGITransport

from db.init_db import init_db, get_connection
from services.orchestrator.main import app as orchestrator_app


@pytest.fixture(scope="module", autouse=True)
def setup_test_data():
    """Ensure database has seed machines and a known anomaly record with diagnosis and feedback."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        # Seed test anomaly
        cursor.execute(
            """
            INSERT OR REPLACE INTO anomaly_records
            (id, machine_id, ts, flagged_sensors, deviation_magnitude, severity, status, created_at)
            VALUES ('anom-audit-test-1', 'ur5e-001', '2026-09-25T01:15:00Z',
                    '["joint_3_torque"]', '{"joint_3_torque": 182.5}', 'critical', 'resolved', '2026-09-25 01:15:00')
            """
        )
        # Seed test diagnosis
        cursor.execute(
            """
            INSERT OR REPLACE INTO diagnoses
            (id, anomaly_id, llm_output, citations, confidence, created_at)
            VALUES ('diag-audit-test-1', 'anom-audit-test-1',
                    'Joint 3 torque spike of 182.5 Nm exceeds maximum rating of 150 Nm. Inspect harmonic drive.',
                    '[{"source_ref": "UR5e_Service_Manual.md#sec-4", "chunk_text": "Joint 3 torque limits...", "relevance_score": 0.95}]',
                    0.92, '2026-09-25 01:15:02')
            """
        )
        # Seed test feedback
        cursor.execute(
            """
            INSERT OR REPLACE INTO feedback
            (id, diagnosis_id, outcome, confirmed_cause, ts)
            VALUES ('fb-audit-test-1', 'diag-audit-test-1', 'corrected',
                    'Payload collision with loading fixture', '2026-09-25 01:20:00')
            """
        )
        # Seed conversation log
        cursor.execute(
            """
            INSERT OR REPLACE INTO conversation_logs
            (id, anomaly_id, machine_id, messages, started_at)
            VALUES ('conv-audit-test-1', 'anom-audit-test-1', 'ur5e-001',
                    '[{"role": "user", "content": "What caused the joint 3 torque alert?"}, {"role": "assistant", "content": "The torque exceeded rated safety margins."}]',
                    '2026-09-25 01:15:10')
            """
        )
        conn.commit()


@pytest.mark.asyncio
async def test_logs_query_and_filtering():
    """Verify GET /logs supports multi-faceted filtering, searching, and pagination."""
    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Basic query
        res = await ac.get("/logs")
        assert res.status_code == 200
        data = res.json()
        assert "issues" in data
        assert data["total"] >= 1
        assert any(i["anomaly_id"] == "anom-audit-test-1" for i in data["issues"])

        # 2. Filter by severity and status
        res = await ac.get("/logs?severity=critical&status=resolved")
        assert res.status_code == 200
        filtered = res.json()
        assert any(i["anomaly_id"] == "anom-audit-test-1" for i in filtered["issues"])

        # 3. Search query
        res = await ac.get("/logs?q=torque")
        assert res.status_code == 200
        search_res = res.json()
        assert len(search_res["issues"]) >= 1

        # 4. Search mismatch
        res = await ac.get("/logs?q=non_existent_laser_welder_xyz")
        assert res.status_code == 200
        assert len(res.json()["issues"]) == 0


@pytest.mark.asyncio
async def test_issue_detail_audit_trail():
    """Verify GET /logs/{anomaly_id} returns complete incident trail."""
    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/logs/anom-audit-test-1")
        assert res.status_code == 200
        detail = res.json()

        assert detail["anomaly_id"] == "anom-audit-test-1"
        assert detail["machine_id"] == "ur5e-001"
        assert detail["severity"] == "critical"
        assert detail["status"] == "resolved"
        assert "joint_3_torque" in detail["anomaly_data"]["flagged_sensors"]

        # Diagnosis check
        assert detail["diagnosis"] is not None
        assert "Joint 3 torque spike" in detail["diagnosis"]["text"]
        assert len(detail["diagnosis"]["citations"]) > 0

        # Feedback check
        assert detail["feedback"] is not None
        assert detail["feedback"]["outcome"] == "corrected"
        assert "collision" in detail["feedback"]["confirmed_cause"].lower()

        # Conversation check
        assert len(detail["conversation"]) >= 2


@pytest.mark.asyncio
async def test_csv_export():
    """Verify GET /logs/export/csv exports RFC-4180 CSV data with correct headers and rows."""
    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/logs/export/csv")
        assert res.status_code == 200
        assert "text/csv" in res.headers.get("content-type", "")
        csv_text = res.text
        lines = csv_text.strip().splitlines()
        assert len(lines) >= 2  # Header + at least 1 record
        header = lines[0]
        assert "Anomaly ID" in header
        assert "Machine ID" in header
        assert "Severity" in header
        assert "anom-audit-test-1" in csv_text


@pytest.mark.asyncio
async def test_pdf_report_generation():
    """Verify GET /logs/export/pdf/{anomaly_id} generates valid binary PDF report."""
    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/logs/export/pdf/anom-audit-test-1")
        assert res.status_code == 200
        assert "application/pdf" in res.headers.get("content-type", "")
        pdf_bytes = res.content
        assert len(pdf_bytes) > 500
        assert pdf_bytes.startswith(b"%PDF-")  # Standard PDF magic header

        # Also verify alternate route /logs/{id}/export/pdf
        res2 = await ac.get("/logs/anom-audit-test-1/export/pdf")
        assert res2.status_code == 200
        assert res2.content.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_fleet_dashboard_summary():
    """Verify /dashboard/summary and /fleet/overview aggregate metrics properly."""
    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/dashboard/summary")
        assert res.status_code == 200
        data = res.json()
        assert data["total_machines"] >= 1
        assert "avg_health_score" in data
        assert 0.0 <= data["avg_health_score"] <= 100.0
        assert "active_alerts" in data
        assert "machines" in data
        assert len(data["machines"]) >= 1

        # Check /fleet/overview alias
        res_overview = await ac.get("/fleet/overview")
        assert res_overview.status_code == 200
        assert res_overview.json()["total_machines"] == data["total_machines"]


@pytest.mark.asyncio
async def test_machines_endpoints():
    """Verify GET /machines and GET /machines/{machine_id}."""
    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/machines")
        assert res.status_code == 200
        machines = res.json()["machines"]
        assert len(machines) >= 1
        assert machines[0]["machine_id"] == "ur5e-001"

        res_single = await ac.get("/machines/ur5e-001")
        assert res_single.status_code == 200
        m = res_single.json()
        assert m["machine_id"] == "ur5e-001"
        assert m["name"] == "UR5e Demo Unit"
        assert m["status"] == "online"


@pytest.mark.asyncio
async def test_chat_chart_intent_detection():
    """Verify chat endpoint detects requests for trends/charts and includes chart_data."""
    transport = ASGITransport(app=orchestrator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Normal chat: no chart intent
        res = await ac.post("/chat", json={"machine_id": "ur5e-001", "message": "What is the recommended payload?"})
        assert res.status_code == 200
        data = res.json()
        assert data.get("chart_data") is None

        # Chart intent: asking for torque trend
        res_chart = await ac.post(
            "/chat",
            json={"machine_id": "ur5e-001", "message": "Can you plot the joint 3 torque trend over time?"},
        )
        assert res_chart.status_code == 200
        chart_res = res_chart.json()
        assert chart_res.get("chart_data") is not None
        chart = chart_res["chart_data"]
        assert chart["chart_type"] == "line"
        assert "Joint 3 Torque" in chart["title"]
        assert "series" in chart
        assert len(chart["series"]) >= 1
        assert len(chart["series"][0]["data"]) > 0
        point = chart["series"][0]["data"][0]
        assert "x" in point and "y" in point
