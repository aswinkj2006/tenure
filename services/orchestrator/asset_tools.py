"""
Tenure — Asset Onboarding Tools:
1. CAD-to-3D-Digital-Twin synthesis (simulated B-Rep to GLTF pipeline)
2. OEM Web Scraping for robotic manipulator specifications
3. LLM Technical Documentation spec extraction
"""

import json
import re
import uuid
from typing import Any
from services.orchestrator.gemini_client import GeminiTechnicianClient

# Curated OEM robotic datasheet database for real-time web scraping lookup
OEM_DATABASE = {
    "ur5e": {
        "model_name": "Universal Robots UR5e (e-Series)",
        "manufacturer": "Universal Robots A/S",
        "type": "robot_arm",
        "payload_kg": 5.0,
        "reach_mm": 850,
        "degrees_of_freedom": 6,
        "repeatability_mm": 0.03,
        "weight_kg": 20.6,
        "nominal_joint_torques": {
            "joint_1": 150.0,
            "joint_2": 150.0,
            "joint_3": 150.0,
            "joint_4": 28.0,
            "joint_5": 28.0,
            "joint_6": 28.0,
        },
        "max_joint_velocities": {
            "joint_1": 180.0,
            "joint_2": 180.0,
            "joint_3": 180.0,
            "joint_4": 180.0,
            "joint_5": 180.0,
            "joint_6": 360.0,
        },
        "recommended_grease": "Mobilgrease 28 / Klüberplex BEM 34-132",
        "service_interval_hours": 5000,
        "datasheet_source": "https://www.universal-robots.com/products/ur5-robot/",
        "summary": "Flexible 6-axis collaborative industrial robot with 5 kg payload and 850 mm reach. Equipped with high-precision harmonic drive gearboxes on joints 1-6.",
    },
    "kuka": {
        "model_name": "KUKA KR 10 Cybertech R1420",
        "manufacturer": "KUKA AG",
        "type": "robot_arm",
        "payload_kg": 10.0,
        "reach_mm": 1420,
        "degrees_of_freedom": 6,
        "repeatability_mm": 0.04,
        "weight_kg": 160.0,
        "nominal_joint_torques": {
            "joint_1": 280.0,
            "joint_2": 320.0,
            "joint_3": 210.0,
            "joint_4": 65.0,
            "joint_5": 55.0,
            "joint_6": 40.0,
        },
        "max_joint_velocities": {
            "joint_1": 300.0,
            "joint_2": 225.0,
            "joint_3": 225.0,
            "joint_4": 381.0,
            "joint_5": 381.0,
            "joint_6": 492.0,
        },
        "recommended_grease": "Castrol Optimol Optigear Synthetic A6",
        "service_interval_hours": 10000,
        "datasheet_source": "https://www.kuka.com/en-de/products/robotics-systems/industrial-robots/kr-cybertech",
        "summary": "Compact, powerful 6-axis industrial robot engineered for high-speed material handling, palletizing, and arc welding with ±0.04 mm repeatability.",
    },
    "fanuc": {
        "model_name": "FANUC CRX-10iA Collaborative Robot",
        "manufacturer": "FANUC Corporation",
        "type": "robot_arm",
        "payload_kg": 10.0,
        "reach_mm": 1249,
        "degrees_of_freedom": 6,
        "repeatability_mm": 0.05,
        "weight_kg": 40.0,
        "nominal_joint_torques": {
            "joint_1": 180.0,
            "joint_2": 190.0,
            "joint_3": 140.0,
            "joint_4": 35.0,
            "joint_5": 35.0,
            "joint_6": 30.0,
        },
        "max_joint_velocities": {
            "joint_1": 120.0,
            "joint_2": 120.0,
            "joint_3": 140.0,
            "joint_4": 180.0,
            "joint_5": 180.0,
            "joint_6": 200.0,
        },
        "recommended_grease": "Molywhite RE No. 00 Grease",
        "service_interval_hours": 8000,
        "datasheet_source": "https://www.fanucamerica.com/products/robots/series/crx/crx-10ia",
        "summary": "Lightweight, maintenance-free collaborative robot offering 8 years of zero maintenance for industrial pick and place applications.",
    },
    "abb": {
        "model_name": "ABB IRB 1200-5/0.9",
        "manufacturer": "ABB Robotics",
        "type": "robot_arm",
        "payload_kg": 5.0,
        "reach_mm": 901,
        "degrees_of_freedom": 6,
        "repeatability_mm": 0.02,
        "weight_kg": 52.0,
        "nominal_joint_torques": {
            "joint_1": 160.0,
            "joint_2": 170.0,
            "joint_3": 130.0,
            "joint_4": 32.0,
            "joint_5": 30.0,
            "joint_6": 25.0,
        },
        "max_joint_velocities": {
            "joint_1": 288.0,
            "joint_2": 240.0,
            "joint_3": 300.0,
            "joint_4": 400.0,
            "joint_5": 405.0,
            "joint_6": 600.0,
        },
        "recommended_grease": "Shell Omala S4 WE 320",
        "service_interval_hours": 6000,
        "datasheet_source": "https://new.abb.com/products/robotics/industrial-robots/irb-1200",
        "summary": "Compact and fast working envelope machine designed for machine tending, material handling and assembly tasks.",
    },
}


def scrape_oem_specifications(query: str) -> dict[str, Any]:
    """
    Simulates real-time web scraping and OEM datasheet retrieval for industrial machines.
    Matches queries against manufacturer product catalogs.
    """
    q_clean = query.strip().lower()

    # Determine matched OEM entry
    matched_key = "ur5e"
    for k in ["kuka", "fanuc", "abb", "ur5", "ur5e", "ur10", "ur16", "crx"]:
        if k in q_clean:
            if "kuka" in k:
                matched_key = "kuka"
            elif "fanuc" in k or "crx" in k:
                matched_key = "fanuc"
            elif "abb" in k:
                matched_key = "abb"
            else:
                matched_key = "ur5e"
            break

    data = OEM_DATABASE.get(matched_key, OEM_DATABASE["ur5e"])
    random_id = f"{matched_key}-{uuid.uuid4().hex[:4]}"

    manual_text = f"""### {data['model_name']} — Official OEM Datasheet & Service Protocol
Manufacturer: {data['manufacturer']}
Source: {data['datasheet_source']}
Kinematic Classification: 6-Axis Articulated Industrial Robot Arm
Nominal Payload: {data['payload_kg']} kg | Maximum Reach: {data['reach_mm']} mm | Repeatability: ±{data['repeatability_mm']} mm

1. Nominal Joint Torque Thresholds:
   - Joint 1 (Base): {data['nominal_joint_torques']['joint_1']} Nm
   - Joint 2 (Shoulder): {data['nominal_joint_torques']['joint_2']} Nm
   - Joint 3 (Elbow / Harmonic Drive): {data['nominal_joint_torques']['joint_3']} Nm (Warning threshold: {data['nominal_joint_torques']['joint_3'] - 10} Nm, E-Stop cutoff: {data['nominal_joint_torques']['joint_3']} Nm)
   - Joint 4 (Wrist 1): {data['nominal_joint_torques']['joint_4']} Nm
   - Joint 5 (Wrist 2): {data['nominal_joint_torques']['joint_5']} Nm
   - Joint 6 (Wrist 3 / Flange): {data['nominal_joint_torques']['joint_6']} Nm

2. Preventive Maintenance & Tribology:
   - Certified Lubricant: {data['recommended_grease']}
   - Scheduled Maintenance Interval: Every {data['service_interval_hours']} operational hours.
   - Diagnostic Symptoms: Harmonic reducer torque spikes or thermal drift indicate gear spalling or foreign particulate intrusion.
"""

    return {
        "machine_id": random_id,
        "name": f"{data['model_name']} — Bay Ingestion",
        "type": data["type"],
        "payload_kg": data["payload_kg"],
        "reach_mm": data["reach_mm"],
        "manufacturer": data["manufacturer"],
        "specs": data,
        "manual_text": manual_text,
        "scraped_url": data["datasheet_source"],
    }


def extract_specs_from_document(doc_text: str, gemini_client: GeminiTechnicianClient | None = None) -> dict[str, Any]:
    """
    Extracts structured machine specifications from freeform service manuals or data sheets.
    """
    # Quick regex extract for fast deterministic response
    payload = 5.0
    reach = 850
    m_id = "ur5e-unit"
    name = "Articulated Industrial Robot"

    p_match = re.search(r'payload[:\s]+([0-9.]+)\s*kg', doc_text, re.IGNORECASE)
    if p_match:
        payload = float(p_match.group(1))

    r_match = re.search(r'reach[:\s]+([0-9.]+)\s*mm', doc_text, re.IGNORECASE)
    if r_match:
        reach = int(float(r_match.group(1)))

    if "kuka" in doc_text.lower():
        m_id = "kuka-kr10"
        name = "KUKA KR 10 Cybertech"
    elif "ur5" in doc_text.lower() or "universal" in doc_text.lower():
        m_id = "ur5e-cell"
        name = "Universal Robots UR5e"
    elif "fanuc" in doc_text.lower():
        m_id = "fanuc-crx"
        name = "FANUC CRX-10iA"

    return {
        "machine_id": f"{m_id}-{uuid.uuid4().hex[:4]}",
        "name": name,
        "type": "robot_arm",
        "payload_kg": payload,
        "reach_mm": reach,
        "location": "Bay 3 — Primary Cell",
        "confidence": 0.96,
        "manual_text": doc_text,
    }


def convert_cad_to_digital_twin(filename: str, file_size_bytes: int = 1048576) -> dict[str, Any]:
    """
    Simulates CAD to 3D Digital Twin compilation pipeline:
    Tessellates B-Rep -> Generates GLTF dual-quaternion skinned mesh -> Links ProtoTwin physics.
    """
    ext = filename.split(".")[-1].upper() if "." in filename else "STEP"
    twin_id = f"twin-{uuid.uuid4().hex[:8]}"

    return {
        "status": "success",
        "twin_id": twin_id,
        "filename": filename,
        "cad_format": ext,
        "triangles_count": 28450,
        "kinematic_joints_inferred": 6,
        "coordinate_frames": ["base_link", "shoulder_link", "upper_arm", "forearm", "wrist_1", "wrist_2", "wrist_3"],
        "physics_binding": "ProtoTwin Headless RigidBody Colliders Linked",
        "render_engine": "Three.js / WebGL 2.0 PBR",
        "message": f"Successfully compiled {filename} into interactive 3D Digital Twin with 6-DOF kinematics.",
    }
