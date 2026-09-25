# Tenure — Cyber-Physical Industrial Reliability & Autonomous AI Technician Platform

> **Autonomous AI-driven predictive maintenance, dynamic technician dispatch, multi-vendor supply chain procurement, and explainable recurrence attribution for industrial robotic fleets.**

---

## 1. Overview

Industrial manufacturing facilities lose billions annually to unplanned robot stoppages and recurring mechanical faults. Standard SCADA systems rely on static threshold alarms that trigger only after mechanical degradation has progressed to catastrophic failure. Furthermore, when recurring failures happen, existing tooling cannot determine whether the repeated failure stems from an ongoing mechanical defect or improper previous repairs by junior technicians.

**Tenure** is a cyber-physical intelligence and autonomous operations platform engineered for industrial robotic arms. It pairs continuous telemetry monitoring with an autonomous agent that predicts impending breakdowns, attributes fault causation through Explainable AI (xAI), dispatches qualified technicians based on real-time availability, and procures out-of-stock components across an industrial supplier network with human-in-the-loop governance.

---

## 2. Multi-Robot Fleet Architecture

Tenure provides out-of-the-box support for leading industrial robotic architectures:

| Robot Model | Kinematic Specs | Workcell Role | Autonomous Capability |
| :--- | :--- | :--- | :--- |
| **Universal Robots UR5e** | 6-DOF, 5 kg payload, 850 mm reach | Precision Deburring & Welding | **xAI Recurrence Attribution**: Differentiates harmonic drive wear from technician installation errors across historical logs. |
| **KUKA KR 10 Cybertech** | 6-Axis, 10 kg payload, 1420 mm reach | Heavy Packaging & Material Handling | **Dynamic Technician Dispatch**: Evaluates skill matrices and automatically reroutes to the next qualified technician when top specialists are busy. |
| **FANUC CRX-10iA** | 6-Axis, 10 kg payload, 1249 mm reach | End-of-Arm Precision Assembly | **Autonomous Multi-Vendor Procurement**: Detects 0-inventory stock, initiates supplier cascade via Slack, and pauses at an xAI authorization gate. |
| **ABB IRB 1200** | 6-Axis, 5 kg payload, 901 mm reach | High-Speed Part Transfer | **Financial Yield Telemetry**: Computes real-time hourly output yield, downtime cost avoidance, and Remaining Useful Life (RUL). |

---

## 3. Core Capabilities

### 3.1 Zero-Shot Telemetry Anomaly Detection
Continuously monitors 6-DOF joint torques, motor angular velocities, thermal gradients, and gripper currents. Using zero-shot residual anomaly scoring, the system detects micro-deviations (e.g., flexspline gear teeth wear, lubrication degradation) before standard alarm thresholds are breached.

### 3.2 Explainable AI (xAI) Recurrence Intelligence
When a machine experiences repeated alerts within an operational window, the agent analyzes historical work orders, technician certifications, and parts used. It produces an 8-step causal trace determining whether:
- The fault is an **Unresolved Machine Defect** (e.g., thermal micro-fractures in harmonic drive gears requiring whole-unit replacement), OR
- The fault is a **Technician Installation Error** (e.g., improper flange bolt torque sequence or incorrect grease viscosity applied by a junior technician).
The system outputs a high-confidence root-cause determination and a permanent corrective plan.

### 3.3 Dynamic Technician Ranking & Availability Dispatch
Evaluates plant floor technicians across a multi-variable matrix:
- **Skill Alignment**: Specific manipulator protocols (KUKA KRC4, Fanuc TP, ABB RAPID).
- **Certification Level**: L1 Junior, L2 Specialist, L3 Master Mechatronics.
- **Historical Success Rate**: Percentage of first-time-fix resolutions.
- **Operational Availability**: When a top-ranked specialist is occupied on an active high-severity ticket, the platform autonomously cascades to the next best qualified, available engineer to prevent production downtime.

### 3.4 Autonomous Multi-Vendor Procurement & Governance
When an anomaly requires a replacement part:
1. Checks the central warehouse database.
2. If stock is zero, scans the supplier network (e.g., MotionPro, Apex Industrial) for component catalogs, real-time lead times, and vendor ratings.
3. Automatically routes priority purchase requests via enterprise communications (Slack integration).
4. **xAI Governance Gate**: Holds financial commitment behind a validation gate requiring supervisor authorization before order execution.

### 3.5 Real-Time Financial Yield & Asset Health
Translates engineering telemetry into executive economic metrics:
- Real-time gross hourly revenue yield based on target cycles/min.
- Net downtime cost avoided per workcell.
- Predicted Remaining Useful Life (RUL) with proactive maintenance windows.

### 3.6 Multimodal Asset Onboarding
Ingests CAD models (STEP, IGES, STL) with automatic B-Rep boundary tessellation and parses OEM technical service manuals via retrieval-augmented generation (RAG) to build persistent per-machine operational intelligence.

---

## 4. Architecture & Technology Stack

The platform is constructed as a distributed, decoupled industrial software suite:

```
tenure/
├── services/
│   ├── orchestrator/      # Central API gateway, dispatch logic, and xAI recurrence engine
│   ├── anomaly_service/   # High-throughput telemetry residual scoring and safety triggers
│   ├── alert_service/     # Event routing, Slack Block Kit notifications, and dispatch alerts
│   └── rag_service/       # Vector indexing and contextual search over OEM manuals
├── db/                    # SQLite relational store with foreign-key schema integrity
├── frontend/              # React 18 SPA with Three.js WebGL digital twins and Vite bundler
├── scripts/               # System initialization and database seeding scripts
└── tests/                 # End-to-end integration and verification test suites
```

- **Backend**: Python 3.11+, FastAPI, Uvicorn, SQLite3, NumPy, Scipy.
- **Frontend**: React 18, Vite, Three.js, Lucide Vector Icons, CSS Design System with editorial typography (`Fraunces`, `Inter`).
- **Integration**: Slack Webhooks / Block Kit messaging, RESTful JSON APIs.

---

## 5. Getting Started

### 5.1 Prerequisites
- **Python**: Version 3.11 or higher
- **Node.js**: Version 18 or higher (with npm)
- **Git**

### 5.2 Repository Setup

Clone the repository and activate your virtual environment:

```bash
git clone https://github.com/aswinkj2006/tenure.git
cd tenure

# Create and activate Python virtual environment
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# On Linux / macOS:
source .venv/bin/activate
```

### 5.3 Install Dependencies

1. **Install Backend Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Install Frontend Dependencies**:
```bash
cd frontend
npm install
cd ..
```

### 5.4 Database Initialization

Initialize the database schema and populate the industrial fleet workcells, technician directory, inventory parts, and supplier catalogs:

```bash
# Run database schema migration and fleet initialization
python scripts/seed_industrial_fleet.py
```

### 5.5 Running the Platform

1. **Start Backend Microservices**:
```bash
python start_services.py
```
This launches all four backend services concurrently:
- Orchestrator: `http://localhost:8000`
- Anomaly Service: `http://localhost:8001`
- Alert Service: `http://localhost:8002`
- RAG Knowledge Service: `http://localhost:8003`

2. **Start Frontend Console**:
In a separate terminal window:
```bash
cd frontend
npm run dev
```
The web console will be available at: `http://localhost:5173`

---

## 6. Verification & Test Suite

To verify system functionality across API endpoints, anomaly detection, technician dispatch, and procurement workflows, run the test suite:

```bash
python -m pytest tests/test_phase6.py -v
```

---

## 7. License

Distributed under the Apache 2.0 License. See `LICENSE` for details.
