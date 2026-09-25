# 🛠️ Tenure — Comprehensive Technical Specification

This document details the architectural, kinematic, mathematical, and algorithmic specifications of the **Tenure** platform.

---

## 1. System Topology & Service Boundaries

Tenure is engineered as a decoupled, multi-service cyber-physical system:

```
[ Industrial Robot / ProtoTwin Sim ]
                 │
                 │ 6-DOF Telemetry Stream (10 Hz)
                 ▼
     [ Anomaly Detection Service :8001 ]
                 │
                 ├── Anomaly Flags & Severity
                 ▼
       [ Alert Service :8002 ] ──────────────► [ Slack Block Kit API ]
                 │
                 │ Alert Events & Escalations
                 ▼
     [ Orchestrator Service :8000 ] ◄────────► [ RAG Service :8003 ]
                 │                                        ▲
                 │ REST / WebSockets                      │ Vector Chunks & Embeddings
                 ▼                                        ▼
   [ React Three.js Frontend :5173 ]            [ ChromaDB Vector Store ]
                 ▲
                 │ Salted PBKDF2 Auth & Pinned Charts
                 ▼
         [ SQLite Local DB ]
```

---

## 2. Authentication & Data Security

### 2.1 Cryptographic Password Hashing
- **Algorithm**: PBKDF2-HMAC-SHA256
- **Iteration Count**: 100,000 rounds
- **Salt Generation**: `secrets.token_hex(16)` (32 hexadecimal characters, 128-bit cryptographic entropy)
- **Constant-Time Verification**: `secrets.compare_digest(computed_hash, stored_hash)` to eliminate timing side-channel attacks.

### 2.2 Local Database Schema (`db/tenure.db`)
```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'technician',
    full_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pinned_charts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    machine_id TEXT,
    title TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    chart_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. Industrial Digital Twin Kinematics & Pick-and-Place Cycle

### 3.1 Robot Model: Universal Robots UR5e
The digital twin simulates a 6-axis articulated manipulator with spherical wrist:
- **Base Link ($J_1$)**: Pan range $\pm 360^\circ$, max velocity $180^\circ/\text{s}$, nominal torque limit $150.0\,\text{Nm}$.
- **Shoulder ($J_2$)**: Lift range $\pm 360^\circ$, nominal torque limit $150.0\,\text{Nm}$.
- **Elbow ($J_3$)**: Forearm pitch range $\pm 360^\circ$, nominal torque limit $150.0\,\text{Nm}$ (target of breakdown degradation).
- **Wrist 1, 2, 3 ($J_4, J_5, J_6$)**: Pitch, yaw, and continuous roll, nominal torque limit $28.0\,\text{Nm}$.

### 3.2 10-Second Industrial Pick-and-Place Cycle Trajectory
Kinematics follow a smooth sinusoidal acceleration profile ($C^2$ continuous S-curve) divided into 5 phases:

$$\theta_j(t) = \theta_{\text{start}} + (\theta_{\text{target}} - \theta_{\text{start}}) \cdot \left[ \frac{1}{2}\left(1 - \cos\left(\pi \frac{t - t_0}{\Delta t}\right)\right) \right]$$

1. **Phase 1: Hover at Feeder Station ($t \in [0.0, 1.5)\,\text{s}$)**:
   - Arm hovers directly above the gravity feeder dispenser.
   - Workpiece is mounted in the dispenser ready for pickup. Gripper open ($0.0$).
2. **Phase 2: Descend & Grasp Workpiece ($t \in [1.5, 3.0)\,\text{s}$)**:
   - Elbow flexes downward ($J_2 = -1.15\,\text{rad}, J_3 = 1.73\,\text{rad}$).
   - Parallel electric gripper closes ($1.0$), attaching the brass workpiece to the end-effector.
3. **Phase 3: Vertical Retraction & Lift ($t \in [3.0, 4.5)\,\text{s}$)**:
   - Arm lifts vertically clearing fixture boundaries. Workpiece ascends smoothly with tool center point (TCP).
4. **Phase 4: S-Curve Swing Transfer ($t \in [4.5, 6.5)\,\text{s}$)**:
   - Base joint pans across a $72^\circ$ azimuth arc ($J_1: -0.52 \to +0.73\,\text{rad}$).
   - Centripetal torque generated dynamically across joints 1 and 2.
5. **Phase 5: Descend, Release onto Place Conveyor & Return ($t \in [6.5, 10.0)\,\text{s}$)**:
   - Arm descends over the outgoing conveyor, gripper releases ($0.0$), leaving the workpiece on the belt.
   - Arm retracts back to home hover pose for the next cycle.

---

## 4. Anomaly Detection & Safety Cutoff Mechanics

### 4.1 Gradual Degradation Modeling
Mechanical breakdown is modeled via progressive harmonic drive torque drift:

$$\tau_3(t) = \tau_{\text{nominal}}(t) + \alpha_{\text{degrade}} \cdot (t - t_{\text{onset}})$$

Where:
- $\tau_{\text{nominal}}(t) \approx 42.0 \sim 48.0\,\text{Nm}$ (nominal payload load under dynamic acceleration)
- $\alpha_{\text{degrade}} = 3.2\,\text{Nm/s}$ (simulated lubricant breakdown rate)
- Accompanying thermal signature: $T(t) = 42.0^\circ\text{C} + 0.22 \cdot (\tau_3(t) - \tau_{\text{nominal}})$

### 4.2 Autonomous Emergency Stop (Safety Cutoff)
When $\tau_3(t) \ge 148.0\,\text{Nm}$ (within $1.3\%$ of the UR5e's structural design limit of $150.0\,\text{Nm}$):
1. **Kinematic Freeze**: Simulation freezes $\dot{\theta}_j = 0$ immediately, locking all 6 joint positions at the exact fault coordinates.
2. **Safety State Propagation**: Status flag `safety_status = "EMERGENCY_STOP_ENGAGED"` is broadcast to all consumers.
3. **Automated Escalation**: Dispatches payload to Alert Service, triggering Slack Block Kit transmission.

---

## 5. Alternative Optical Sensing Suite Specifications

When physical transducers cannot be installed, Tenure processes camera streams:

```
[ High-Speed Industrial Camera (120 FPS) ]
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
 [ EVM Bandpass Filter ]   [ 6D Keypoint Pose ]
 (0.5 - 50 Hz Vibrations)  (Kinematic Reconstruction)
         │                       │
         ▼                       ▼
 [ Micro-Vibrations ]      [ Digital Twin Pose ]
```

1. **Eulerian Video Magnification (EVM)**:
   - Spatial decomposition via Laplacian pyramid: $I_L(x, y, t)$.
   - Temporal IIR bandpass filtering isolating frequency band $f \in [10\,\text{Hz}, 60\,\text{Hz}]$ corresponding to harmonic gear meshing frequencies.
   - Magnification factor $\alpha = 30\times$ converts $15\,\mu\text{m}$ mechanical backlash into observable pixel motion.
2. **FLIR Radiometric Thermal Mapping**:
   - Long-wave infrared (LWIR, $8 - 14\,\mu\text{m}$) monitoring stator and harmonic reducer surface temperatures.
   - Detects thermal anomalies when $\Delta T > 12^\circ\text{C}$ above ambient.

---

## 6. RAG Grounding & RLHF Self-Healing

1. **Document Ingestion**:
   - Ingests official *UR5e Service Manual (Document version 5.12)* broken into 500-token semantic chunks with 10% overlap.
   - Vectorized via Google Gemini embedding model into ChromaDB collection `machine_ur5e-001`.
2. **Technician Chatbot Grounding**:
   - Retrieval queries fetch top-3 semantic chunks.
   - System prompt strictly constrains LLM output: every diagnostic statement must cite source manual section and page.
3. **Reinforcement Learning from Human Feedback (RLHF)**:
   - When a technician marks an issue as "Fixed & Verified", the confirmed root cause and repair notes are encapsulated as an authorized incident resolution chunk.
   - The chunk is indexed into ChromaDB with metadata `verified_by_technician: true` and a boosted retrieval priority weight of $1.5\times$.
   - The Orchestrator automatically calls Anomaly Service `/reset-safety-stop`, clearing the E-Stop and restarting machine kinematics without requiring manual PLC intervention.
