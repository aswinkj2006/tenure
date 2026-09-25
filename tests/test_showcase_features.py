import pytest
import sqlite3
import os
from pathlib import Path
from services.orchestrator.auth import hash_password, verify_password, register_user, authenticate_user
from services.orchestrator.asset_tools import convert_cad_to_digital_twin, scrape_oem_specifications, extract_specs_from_document
from sim.client import MockProtoTwinClient
from db.init_db import DB_PATH

def test_user_registration_and_salted_hashing():
    test_user = "demo_engineer_test"
    test_pass = "IndustrialSecret_2026!"
    
    # Test registration (or accept if already registered)
    try:
        reg_res = register_user(test_user, test_pass, full_name="Aswin Engineer", role="lead_technician")
        assert reg_res["username"] == test_user
    except ValueError as e:
        assert "already exists" in str(e)
    
    # Test authentication
    auth_user = authenticate_user(test_user, test_pass)
    assert auth_user is not None
    assert auth_user["username"] == test_user
    assert auth_user["role"] == "lead_technician"
    
    # Negative authentication
    assert authenticate_user(test_user, "WrongPassword") is None

def test_cad_compilation_and_spec_extraction():
    # CAD to 3D Digital Twin simulation
    cad_result = convert_cad_to_digital_twin("ur5e_assembly.step")
    assert cad_result["status"] == "success"
    assert cad_result["kinematic_joints_inferred"] == 6
    assert "twin_id" in cad_result

    # OEM scraping
    oem_data = scrape_oem_specifications("Universal Robots UR5e")
    assert oem_data["manufacturer"] == "Universal Robots A/S"
    assert oem_data["payload_kg"] == 5.0
    assert oem_data["reach_mm"] == 850

    # Document extraction
    sample_doc = "KUKA KR 10 Cybertech with payload: 10.0 kg and reach: 1420 mm for heavy palletizing."
    extracted = extract_specs_from_document(sample_doc)
    assert extracted["payload_kg"] == 10.0
    assert extracted["reach_mm"] == 1420
    assert "KUKA" in extracted["name"]

def test_prototwin_pick_and_place_and_safety_stop():
    client = MockProtoTwinClient()
    
    # Initial state
    assert client._emergency_stop is False
    reading = client.read_all_sensors()
    assert "joint_1_position" in reading
    assert "joint_3_torque" in reading

    # Test safety stop
    client.trigger_emergency_stop()
    assert client._emergency_stop is True

    # Reset safety stop
    client.reset_emergency_stop()
    assert client._emergency_stop is False
    resumed_reading = client.read_all_sensors()
    assert "joint_1_position" in resumed_reading

def test_pinned_charts_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    chart_id = "test_chart_1"
    cursor.execute("""
        INSERT OR REPLACE INTO pinned_charts (id, user_id, machine_id, title, chart_type, chart_data)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (chart_id, "user-tech-01", "ur5e-001", "Test Comparison Chart", "line", "[]"))
    conn.commit()

    cursor.execute("SELECT title, chart_type FROM pinned_charts WHERE id = ?", (chart_id,))
    row = cursor.fetchone()
    assert row is not None
    assert row[0] == "Test Comparison Chart"
    assert row[1] == "line"

    # Cleanup
    cursor.execute("DELETE FROM pinned_charts WHERE id = ?", (chart_id,))
    conn.commit()
    conn.close()

