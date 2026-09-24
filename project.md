# Tenure — Engineering Brief (for coding tools / AI dev assistants)

This is a technical implementation brief. Use it as project context before generating code, scaffolding repos, or answering implementation questions for this project. Project name: **Tenure** — every machine gets an AI technician with tenure on that specific unit.

## What we're building

A hackathon MVP: a system where each industrial machine gets an isolated anomaly-detection + knowledge layer ("brain"), and a shared LLM ("body") reasons over it to diagnose issues and power a technician/overseer-facing dashboard. For the demo, the machine is simulated in ProtoTwin as a **Universal Robots UR5e** 6-axis arm, driven via Python instead of real hardware.

## Target robot for the demo: UR5e

Chosen specifically because it has full, official, freely available technical documentation and models — which matters both for building the ProtoTwin simulation quickly and for demonstrating the "digital twin from documentation" story to judges:

- **Official CAD**: Universal Robots publishes STEP CAD files for the UR5e directly.
- **Official URDF**: the `ur_description` package (maintained by Universal Robots) contains the UR5e's links, joints, meshes, kinematic structure, joint limits, and physical parameters, ready to use.
- **Official documentation set**: installation, robot configuration, safety, communication, end-effectors, maintenance, programming, and full specifications — this is the actual manual set to ingest into the RAG knowledge store for this machine.
- **ProtoTwin's robot controller** auto-detects the robot's axes and handles forward/inverse kinematics for industrial arms, so the UR5e is a supported/expected case, not a fight against the tool.
- **MuJoCo Menagerie** has a ready-to-use UR5e model (description + meshes) usable as a reference while building the ProtoTwin model.
- Portable later to ROS → Gazebo → Isaac Sim → MuJoCo without starting over, if the project extends past the hackathon.

**Build phases for the sim (as scoped):**
1. **Phase 1 — Robot**: UR5e, 6 joints, driven from Python via ProtoTwin Connect.
2. **Phase 2 — Sensors**: joint position, joint velocity, joint torque, TCP position, plus distance/force sensors as needed.
3. **Phase 3 — AI**: Python receives the joint/TCP/sensor vector (`[joint1..joint6, tcp_x, tcp_y, tcp_z, sensor_value]`) and feeds it into the anomaly detection service described below.

ProtoTwin Connect's Python client acts as the simulation master — it can step the simulation and read/write signal values, which is exactly the interface the anomaly service needs to consume. Use ProtoTwin's own SCARA pick-and-place tutorial as the learning reference for modeling/physics/motors/sensors/robot controller mechanics, while building the actual UR5e as the target model.

## Tech stack (target for this build)

| Layer | Choice | Notes |
|---|---|---|
| Machine simulation | ProtoTwin (UR5e model) + Python via ProtoTwin Connect | Simulates joint/TCP/sensor streams and lets us inject anomalies on demand for the demo |
| Anomaly detection | Pretrained time-series foundation model (e.g. Chronos, MOMENT, or TimesFM) | Zero-shot inference, no training required to start |
| Retrieval-augmented anomaly refinement | Custom retrieval layer inspired by RATFM / Forecast2Anomaly (2025 research) | Retrieves similar past sequences from this machine's vector store to condition predictions |
| Vector DB / RAG store | Qdrant or Chroma | One collection/namespace per `machine_id` |
| LLM orchestration | FastAPI service wrapping an LLM API | Retrieval step before generation; must return citations (source doc/chunk) alongside the answer |
| Backend framework | Python, FastAPI | For anomaly service, orchestration service, and ingestion service |
| Frontend | React | Dashboard, chatbot panel, 3D twin viewport, per-machine detail page |
| 3D twin rendering | ProtoTwin's own viewer/export | For the demo, ProtoTwin's native view is sufficient — don't over-invest in a custom Three.js viewport |
| Sensor transport | ProtoTwin Connect (Python) → backend via WebSocket or REST | No need for real MQTT/OPC-UA infra in the hackathon build |
| Deployment (post-hackathon target) | Docker Compose | Not required for the demo itself, but structure the code so each service is independently containerizable |

## Suggested repo structure

```
tenure/
├── sim/                     # ProtoTwin UR5e project + Python client (ProtoTwin Connect), anomaly injection scripts
├── services/
│   ├── anomaly_service/     # Wraps the time-series foundation model + retrieval layer
│   ├── rag_service/         # Vector store client, per-machine collections, ingestion of UR5e manuals/docs
│   ├── orchestrator/        # LLM orchestration: takes a query + machine_id, retrieves context, calls LLM, returns cited answer
│   └── alert_service/       # Consumes anomaly flags, applies severity tiering, pushes to frontend
├── frontend/
│   ├── dashboard/           # Fleet-wide view, health/efficiency scores
│   ├── machine-page/        # Per-machine: 3D twin embed, sensor readings, chatbot panel
│   ├── logs-page/           # Per-issue log records, filterable, downloadable — see "Logs page" section below
│   └── chatbot/             # Shared chat component (used on both dashboard and machine page)
├── data/
│   └── docs/                # UR5e official documentation set, to be ingested at "onboarding"
└── docker-compose.yml
```

## Data model

```
machines(machine_id, name, type, install_date)
  -- for the demo: one row, type = "UR5e"

sensor_readings(machine_id, ts, sensor_name, value)
  -- streamed from sim/ (joint position/velocity/torque, TCP position, distance/force sensors)

anomaly_records(id, machine_id, ts, flagged_sensors: json, deviation_magnitude: json, severity, status)
  -- written by anomaly_service when the foundation model flags a deviation

diagnoses(id, anomaly_id, llm_output: text, citations: json, confidence)
  -- written by orchestrator after retrieval + LLM call

feedback(id, diagnosis_id, outcome: enum[confirmed, corrected], confirmed_cause: text, ts)
  -- written when technician responds in the UI; pushed back into rag_service's vector store for that machine_id

conversation_logs(id, anomaly_id, machine_id, messages: json, started_at, resolved_at)
  -- full technician<->LLM chat transcript tied to one specific issue, from first alert to final feedback;
  -- this is what the logs page reconstructs as "problem + solution" per issue

vector_documents(machine_id, doc_type: enum[manual, incident, feedback], chunk_text, embedding, source_ref)
  -- one namespace per machine_id in the vector DB; seeded from UR5e's official documentation set
```

## Component behavior specs

**anomaly_service**
- Input: streaming joint/TCP/sensor readings for `machine_id` (the UR5e, for the demo).
- Zero-shot mode (default, no prior data needed): run the pretrained foundation model directly on the incoming window; flag when the deviation/reconstruction score crosses a threshold.
- Retrieval-augmented mode (once `vector_documents` has confirmed incidents for this `machine_id`): before scoring, retrieve the most similar past windows for this machine and condition the prediction on them (RATFM/F2A pattern — implement as a simple nearest-neighbor lookup against stored embeddings of past confirmed anomaly windows; the point for the demo is showing the mechanism working, not reproducing the full paper).
- Output: writes to `anomaly_records`, calls `alert_service`.

**rag_service**
- Ingests documents (UR5e manuals, past incidents, feedback records) into the vector store, namespaced by `machine_id`.
- Exposes a retrieval endpoint: given a `machine_id` and a query embedding, return top-k relevant chunks with their source reference (for citations).

**orchestrator**
- Exposes two endpoints: `/diagnose` (given an `anomaly_id`, retrieve context and produce a diagnosis) and `/chat` (given a `machine_id` and a free-text question, retrieve context and answer — used by both the technician app and the overseer dashboard chatbot).
- Every response must include citations (which chunk/source it drew from) — don't let the LLM answer without grounding; this is a stated product requirement, not optional polish.
- Supports a "generate a chart" intent for the dashboard chatbot: detect when the user is asking for a visualization rather than a text answer, and return structured data the frontend can render as a chart, with a flag for whether the user wants to keep it pinned to the dashboard.

**alert_service**
- Receives anomaly flags, applies a severity threshold, and can send a "stop/slowdown" command back to the sim (ProtoTwin Connect, for the demo) for high-severity flags. Push the alert to the frontend for the technician view.

**feedback loop**
- When a technician confirms/corrects a diagnosis via the frontend, write to `feedback`, then immediately push a corresponding chunk into `vector_documents` for that `machine_id` (this closes the loop — no separate offline job needed for the demo).
- Every message exchanged between the technician and the LLM during that issue (from initial alert through the confirm/correct step) gets appended to that issue's `conversation_logs` row — this is the raw material the logs page reads from.

**logs_service (or a module inside orchestrator — doesn't need to be a separate microservice for the hackathon build)**
- For each resolved or in-progress issue, assembles one log entry by joining `anomaly_records` + `diagnoses` + `conversation_logs` + `feedback` for that `anomaly_id` — this gives a single record containing: what was flagged, what the LLM diagnosed (with citations), the full conversation, what the technician actually did, and whether the diagnosis was confirmed or corrected.
- Exposes a query endpoint supporting filters: `machine_id`, date range, severity, status (open/resolved), outcome (confirmed/corrected), and free-text search over the conversation content.
- Exposes an export endpoint that returns the filtered result set as CSV (for spreadsheet/record-keeping use) or PDF (for a single issue's full report, useful for compliance/audit purposes in regulated industries) — this is what powers the "download" requirement.

## Logs page (frontend)

A dedicated page, separate from the dashboard and the per-machine detail page:
- **List view**: one row per issue, showing machine, timestamp, severity, status, and outcome at a glance.
- **Filtering**: by machine, date range, severity, status, and outcome — all combinable, not exclusive toggles.
- **Detail view**: clicking an issue opens its full record — the anomaly data that triggered it, the LLM's diagnosis with citations, the complete technician↔LLM conversation for that issue, and the final confirmed/corrected outcome.
- **Download**: export either the currently filtered list (CSV) or a single issue's full detail (PDF) — this is a stated requirement for record-keeping, not optional.
- **Machine-based grouping**: since logs are tied to `machine_id`, the per-machine detail page should also link directly into this logs page pre-filtered to that machine, rather than duplicating log data in two places.

## Build priority for the hackathon (in order)

1. ProtoTwin UR5e model wired to Python via ProtoTwin Connect, streaming joint/TCP values, with a way to manually trigger an anomaly (e.g. force an out-of-range joint torque or velocity).
2. Zero-shot anomaly detection running against that stream (this alone proves the "no cold start" claim — get this working and demoable first).
3. Basic vector store with the UR5e's official documentation ingested; a simple retrieval endpoint.
4. Orchestrator that takes an anomaly + retrieves manual context + calls an LLM + returns a cited diagnosis.
5. Minimal frontend: sensor readings + alert + diagnosis text on one page. (3D twin embed and full dashboard polish come after this works end-to-end.)
6. Feedback capture that writes back into the vector store, and a second anomaly injection to demonstrate the retrieval-augmented improvement live. At this point `conversation_logs` should already be populating from step 4 onward — verify one full issue record is reconstructable before moving on.
7. Logs page: list view with filtering (machine, date, severity, status, outcome) and detail view showing the full per-issue record. Build this before the fleet dashboard — logs only need data you already have from steps 1–6, while the dashboard needs aggregation across multiple issues/machines to look convincing.
8. CSV/PDF export on the logs page.
9. Fleet dashboard and chatbot-on-demand-charts — only after steps 1–8 work reliably.

## Constraints to respect while building

- Every diagnosis the orchestrator returns must carry a citation — don't let it fall back to an ungrounded LLM answer even in a demo shortcut.
- Keep anomaly detection zero-shot-first — don't build a flow that assumes historical training data exists, since "works with zero prior data" is the core claim being demoed.
- Don't build real OEM sensor integration — the ProtoTwin simulator is the intentional data source for this build; don't add scope trying to connect to real machine protocols.
- A human (technician) must be the one to confirm/correct every diagnosis — don't build any auto-applied "fix" action; the only automated action is the safety stop/slowdown signal.
- Logs are append-only — once a conversation message or feedback entry is written to `conversation_logs`/`feedback`, don't overwrite or delete it; this matters both for the demo (judges may ask about audit trails) and for the real product's compliance story in regulated industries.