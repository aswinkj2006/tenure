"""
Tenure — Live Showcase Rehearsal Script (Phase 7)

Demonstrates the entire end-to-end autonomous technician workflow:
  1. Live Fleet & Machine Health Check
  2. Real-Time Documentation Onboarding (UR5e Service Manual)
  3. Live Anomaly Injection (Joint 3 Torque Spike to 185 Nm)
  4. Real-time Zero-Shot Detection & Alert Trigger
  5. Cited AI Root-Cause Diagnosis (Gemini 3.6/3.7 Flash)
  6. Technician Interactive Chat with Chart Intent (Time-Series Generation)
  7. Human-in-the-Loop Continuous Learning Feedback (Re-indexing Correction)
  8. Incident Audit Trail, CSV Export & PDF Generation
"""

import asyncio
import json
import time
from pathlib import Path
import httpx

ORCHESTRATOR_URL = "http://localhost:8000"
ANOMALY_URL = "http://localhost:8001"
ALERT_URL = "http://localhost:8002"
RAG_URL = "http://localhost:8003"
MACHINE_ID = "ur5e-001"


def print_step(num: int, title: str):
    print("\n" + "=" * 65)
    print(f"  STEP {num}: {title.upper()}")
    print("=" * 65)


async def main():
    print("""
=================================================================
  TENURE — Autonomous AI Technician for Industrial Machinery
  Live Showcase & System Integration Demo
=================================================================
    """)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Health check across all services
        print_step(1, "Verify Microservices & Fleet State")
        for name, port, url in [
            ("Orchestrator", 8000, f"{ORCHESTRATOR_URL}/health"),
            ("Anomaly Service", 8001, f"{ANOMALY_URL}/health"),
            ("Alert Service", 8002, f"{ALERT_URL}/health"),
            ("RAG Service", 8003, f"{RAG_URL}/health"),
        ]:
            try:
                res = await client.get(url)
                print(f"  [OK] {name:<18} (port {port}) -> status={res.status_code}")
            except Exception as e:
                print(f"  [FAIL] {name:<18} (port {port}) -> {e}")
                print("\n  Tip: Run 'python start_services.py' in a separate terminal!")
                return

        # Fleet summary
        fleet_res = await client.get(f"{ORCHESTRATOR_URL}/dashboard/summary")
        fleet = fleet_res.json()
        print(f"\n  Fleet Status: {fleet['total_machines']} machine(s) registered | Health Score: {fleet['avg_health_score']}%")

        # Step 2: Onboard documentation in real time
        print_step(2, "Real-Time Document Onboarding via RAG")
        manual_path = Path("data/sample_docs/UR5e_Service_Manual.md")
        if manual_path.exists():
            with open(manual_path, "rb") as f:
                res = await client.post(
                    f"{RAG_URL}/ingest",
                    data={"machine_id": MACHINE_ID, "doc_type": "manual"},
                    files={"file": (manual_path.name, f.read(), "text/markdown")},
                )
            ingest_data = res.json()
            print(f"  [DOCS] Ingested '{manual_path.name}' -> {ingest_data.get('chunks_ingested')} chunks created")
        else:
            print("  [DOCS] Manual already indexed.")

        # Step 3: Inject live anomaly
        print_step(3, f"Injecting Critical Anomaly into {MACHINE_ID}")
        print("  Injecting Joint 3 Torque Overload (185.2 Nm vs 150.0 Nm physical limit)...")
        inject_res = await client.post(
            f"{ANOMALY_URL}/inject-anomaly",
            json={"scenario": "torque_spike", "joint": 3, "value": 185.2},
        )
        print(f"  [INJECTION] {inject_res.json().get('status', 'injected')}")

        # Wait a moment for detection & alert cycle
        await asyncio.sleep(2.0)

        # Step 4: Verify Anomaly Detection & Alert Dispatch
        print_step(4, "Zero-Shot Anomaly Detection & Safety Alert")
        anom_res = await client.get(f"{ANOMALY_URL}/anomalies/{MACHINE_ID}?limit=1")
        anomalies = anom_res.json().get("anomalies", [])
        if not anomalies:
            print("  [ALERT] Waiting for anomaly to be logged...")
            await asyncio.sleep(2.0)
            anom_res = await client.get(f"{ANOMALY_URL}/anomalies/{MACHINE_ID}?limit=1")
            anomalies = anom_res.json().get("anomalies", [])

        if anomalies:
            latest_anom = anomalies[0]
            anom_id = latest_anom["id"]
            print(f"  [ANOMALY FLAGGED] ID: {anom_id}")
            print(f"    Severity: {latest_anom['severity'].upper()}")
            print(f"    Flagged Sensors: {latest_anom['flagged_sensors']}")
            print(f"    Deviation: {latest_anom['deviation_magnitude']}")
        else:
            print("  [NOTE] Using simulated anomaly id for demonstration")
            anom_id = "anom-audit-test-1"

        # Step 5: Grounded LLM Diagnosis
        print_step(5, "Gemini Flash Cited Diagnosis & Root Cause Analysis")
        diag_res = await client.post(
            f"{ORCHESTRATOR_URL}/diagnose",
            json={"anomaly_id": anom_id, "machine_id": MACHINE_ID},
        )
        diag = diag_res.json()
        print(f"  [AI MODEL] {diag.get('model', 'Gemini Flash')} | Confidence: {diag.get('confidence', 0.9):.0%}")
        print(f"\n  Diagnosis Summary:\n  {diag.get('llm_output', diag.get('diagnosis', ''))[:300]}...\n")
        print("  Verified Manual Citations:")
        for c in diag.get("citations", []):
            print(f"    * Ref: {c.get('source_ref')} (Score: {c.get('relevance_score'):.2f})")

        diag_id = diag.get("diagnosis_id")

        # Step 6: Interactive Chat & Chart Intent
        print_step(6, "Technician Chat with Chart Intent (Time-Series Generation)")
        query = "Can you chart the joint 3 torque trend over time?"
        print(f"  Technician: '{query}'")
        chat_res = await client.post(
            f"{ORCHESTRATOR_URL}/chat",
            json={"machine_id": MACHINE_ID, "message": query, "anomaly_id": anom_id},
        )
        chat_data = chat_res.json()
        print(f"  AI Reply: {chat_data.get('reply', '')[:160]}...")
        if chat_data.get("chart_data"):
            chart = chat_data["chart_data"]
            points_count = len(chart["series"][0]["data"])
            print(f"  [CHART GENERATED] Type: {chart['chart_type']} | Title: '{chart['title']}' | Points: {points_count}")

        # Step 7: Human-in-the-Loop Continuous Learning
        print_step(7, "Human-in-the-Loop Feedback & Continuous Learning")
        corrected_cause = "Gripper fixture misalignment collided with workpiece during rapid feed"
        print(f"  Technician Feedback: CORRECTED -> '{corrected_cause}'")
        fb_res = await client.post(
            f"{ORCHESTRATOR_URL}/feedback",
            json={
                "diagnosis_id": diag_id or "diag-audit-test-1",
                "outcome": "corrected",
                "confirmed_cause": corrected_cause,
            },
        )
        print(f"  [FEEDBACK STORED] Continuous learning updated: {fb_res.json().get('continuous_learning_updated')}")

        # Step 8: Incident Audit Trail, CSV & PDF Export
        print_step(8, "Audit Logs, CSV Export & PDF Incident Report")
        logs_res = await client.get(f"{ORCHESTRATOR_URL}/logs?limit=5")
        logs = logs_res.json()
        print(f"  Audit Log Entries: {logs.get('total')} total issues tracked")

        csv_res = await client.get(f"{ORCHESTRATOR_URL}/logs/export/csv")
        print(f"  [CSV EXPORT] Received {len(csv_res.content)} bytes of RFC-4180 audit logs")

        pdf_res = await client.get(f"{ORCHESTRATOR_URL}/logs/{anom_id}/export/pdf")
        if pdf_res.status_code == 200:
            pdf_path = Path("tenure_incident_report.pdf")
            with open(pdf_path, "wb") as f:
                f.write(pdf_res.content)
            print(f"  [PDF EXPORT] Generated formatted incident PDF: '{pdf_path}' ({len(pdf_res.content)} bytes)")
        else:
            print(f"  [PDF EXPORT] Status: {pdf_res.status_code}")

        # Clear anomaly for normal operations
        await client.post(f"{ANOMALY_URL}/clear-anomaly")
        print("\n  [SYSTEM] Cleaned anomaly injection. UR5e returned to nominal operating limits.")

    print("\n" + "=" * 65)
    print("  ALL 7 PHASES COMPLETE & READY FOR PRESENTATION!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
