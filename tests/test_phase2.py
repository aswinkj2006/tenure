"""
Tenure — Phase 2 Verification Tests

Tests:
1. AnomalyDetector domain limit and statistical evaluation
2. AlertService lifecycle and safety tiering
3. End-to-end anomaly flow: injection -> detection -> DB record -> alert
"""

import asyncio
import pytest
from httpx import AsyncClient, ASGITransport

from db.init_db import init_db, get_connection
from services.anomaly_service.detector import AnomalyDetector
from services.anomaly_service.main import app as anomaly_app, lifespan as anomaly_lifespan
from services.alert_service.main import app as alert_app


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()


def test_detector_normal_readings():
    """Verify normal telemetry produces no anomalies."""
    detector = AnomalyDetector()
    normal_reading = {
        "ts": "2026-09-25T00:00:00Z",
        "sensors": {
            "joint_1_torque": 45.0,
            "joint_2_torque": 60.0,
            "joint_3_torque": 50.0,
            "joint_4_torque": 15.0,
            "joint_5_torque": 10.0,
            "joint_6_torque": 4.0,
        },
    }
    result = detector.evaluate(normal_reading)
    assert not result.is_anomaly
    assert len(result.flagged_sensors) == 0


def test_detector_physical_limit_violation():
    """Verify exceeding physical torque limits flags critical/high severity."""
    detector = AnomalyDetector()
    anomalous_reading = {
        "ts": "2026-09-25T00:00:01Z",
        "sensors": {
            "joint_1_torque": 45.0,
            "joint_2_torque": 60.0,
            "joint_3_torque": 185.0,  # Limit is 150 Nm, 185 is > 1.2x (critical)
            "joint_4_torque": 15.0,
            "joint_5_torque": 10.0,
            "joint_6_torque": 4.0,
        },
    }
    result = detector.evaluate(anomalous_reading)
    assert result.is_anomaly
    assert "joint_3_torque" in result.flagged_sensors
    assert result.severity in ("high", "critical")
    assert result.deviation_magnitude["joint_3_torque"] == 35.0


@pytest.mark.asyncio
async def test_alert_service_lifecycle():
    """Verify alert service creates, broadcasts, acknowledges, and resolves alerts."""
    transport = ASGITransport(app=alert_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create critical alert
        res = await ac.post(
            "/alerts",
            json={
                "anomaly_id": "test-anomaly-001",
                "machine_id": "ur5e-001",
                "severity": "critical",
                "flagged_sensors": ["joint_3_torque"],
                "deviation_magnitude": {"joint_3_torque": 35.0},
            },
        )
        assert res.status_code == 200
        alert_data = res.json()["alert"]
        assert alert_data["severity"] == "critical"
        assert alert_data["safety_action"] == "EMERGENCY_STOP_TRIGGERED"
        alert_id = alert_data["id"]

        # List alerts
        res = await ac.get("/alerts/ur5e-001")
        assert res.status_code == 200
        active_list = res.json()["active"]
        assert any(a["id"] == alert_id for a in active_list)

        # Acknowledge
        res = await ac.post(f"/alerts/{alert_id}/acknowledge")
        assert res.status_code == 200

        # Resolve
        res = await ac.post(f"/alerts/{alert_id}/resolve")
        assert res.status_code == 200


@pytest.mark.asyncio
async def test_e2e_anomaly_detection_and_db_persistence():
    """Verify end-to-end: inject anomaly -> loop flags -> saved in DB."""
    async with anomaly_lifespan(anomaly_app):
        transport = ASGITransport(app=anomaly_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Inject anomaly on joint 3 torque
            res = await ac.post("/inject-anomaly?joint=3&anomaly_type=torque&value=188.0")
            assert res.status_code == 200

            # Wait briefly for background stream loop to process the reading
            await asyncio.sleep(0.3)

            # Query anomalies endpoint
            res = await ac.get("/anomalies/ur5e-001")
            assert res.status_code == 200
            anomalies = res.json()["anomalies"]
            assert len(anomalies) > 0
            first = anomalies[0]
            assert "joint_3_torque" in first["flagged_sensors"]
            assert first["severity"] in ("high", "critical")

            # Clean up
            await ac.post("/clear-anomaly")
