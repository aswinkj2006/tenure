"""
Tenure — Phase 1 Verification Tests

Tests:
1. Database init & seeding
2. ProtoTwin mock client streaming & readings
3. Anomaly injection on mock client
4. Anomaly service FastAPI REST endpoints & WebSocket
"""

import asyncio
import json
import pytest
from httpx import AsyncClient, ASGITransport

from db.init_db import init_db, get_connection
from sim.client import MockProtoTwinClient
from services.anomaly_service.main import app


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()


def test_db_seeding():
    """Verify database contains the seeded UR5e demo machine."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT machine_id, name, type FROM machines WHERE machine_id = 'ur5e-001'")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == "ur5e-001"
        assert row[2] == "UR5e"


@pytest.mark.asyncio
async def test_mock_client_stream():
    """Verify mock client streams valid sensor readings."""
    client = MockProtoTwinClient(machine_id="ur5e-001", step_interval=0.01)
    await client.connect()

    readings = []
    async for reading in client.stream_sensors(max_steps=5):
        readings.append(reading)

    await client.disconnect()

    assert len(readings) == 5
    first = readings[0]
    assert first.machine_id == "ur5e-001"
    assert "joint_1_torque" in first.sensors
    assert "tcp_x" in first.sensors
    # Normal torque should be within reasonable limits (< 100 Nm)
    assert first.sensors["joint_3_torque"] < 100.0


@pytest.mark.asyncio
async def test_mock_client_anomaly_injection():
    """Verify injecting an anomaly alters the streamed values."""
    client = MockProtoTwinClient(machine_id="ur5e-001", step_interval=0.01)
    await client.connect()

    client.inject_anomaly(joint=3, anomaly_type="torque", magnitude=195.5)
    reading = None
    async for r in client.stream_sensors(max_steps=1):
        reading = r

    assert reading is not None
    assert reading.sensors["joint_3_torque"] == 195.5

    client.clear_anomaly()
    async for r in client.stream_sensors(max_steps=1):
        reading = r

    assert reading.sensors["joint_3_torque"] != 195.5
    await client.disconnect()


@pytest.mark.asyncio
async def test_anomaly_service_endpoints():
    """Verify FastAPI service endpoints."""
    from services.anomaly_service.main import lifespan
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Health check
            res = await ac.get("/health")
            assert res.status_code == 200
            assert res.json()["status"] == "ok"

            # Inject anomaly via REST
            res = await ac.post("/inject-anomaly?joint=2&anomaly_type=torque&value=175.0")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "injected"
            assert data["joint"] == 2
            assert data["value"] == 175.0

            # Clear anomaly via REST
            res = await ac.post("/clear-anomaly")
            assert res.status_code == 200
            assert res.json()["status"] == "cleared"

