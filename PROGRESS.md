# Tenure — Build Progress Log

Last updated: 2026-09-25T01:27:00+05:30

## Current phase
Phase 7 — Showcase Demo Preparation & System Polish

## Status
Phases 0, 1, 2, 3, 5, and 6 are fully completed, integrated, and verified with 19/19 automated tests passing across 4 test suites.
All backend microservices (Orchestrator, Anomaly Service, Alert Service, RAG Service) are fully functional:
1. Real-time telemetry streaming over WebSocket (`ws://localhost:8001/ws/sensors/{machine_id}`) with live ProtoTwin signal calibration (stride 7 starting at address 2).
2. Zero-shot anomaly detection with physical domain limits and dynamic rolling Z-scores.
3. Alert lifecycle and safety tiering with WebSocket push (`ws://localhost:8002/ws/alerts/{machine_id}`) and auto emergency-stops.
4. Multi-format real-time document onboarding (`POST /ingest` on 8003) and semantic search with citation references.
5. Grounded AI technician diagnosis (`POST /diagnose` on 8000) using Gemini 3.6/3.7 Flash with citations.
6. Interactive technician chat (`POST /chat` on 8000) with automatic chart intent detection for time-series sensor trends.
7. Continuous learning feedback loop (`POST /feedback` on 8000) re-indexing technician corrections into the vector store.
8. Audit Logs & incident reporting with multi-faceted filtering (`GET /logs`, `GET /logs/{id}`), RFC-4180 CSV export (`GET /logs/export/csv`), and styled PDF incident audit generation (`GET /logs/export/pdf/{id}`).
9. Fleet Dashboard & machine aggregation (`GET /dashboard/summary`, `GET /fleet/overview`, `GET /machines`, `GET /machines/{id}`) with dynamic health scoring (0–100).
10. Unified runner `start_services.py` to start all backend services simultaneously.

## Completed
- [Phase 0] Project setup: git init, .gitignore, FRONTEND_SPEC.md, SHARED_CONTEXT.md, PROGRESS.md, branch strategy (main/backend/frontend)
- [Phase 1] Simulation foundation:
  - `sim/client.py`: ProtoTwin Connect client wrapper + realistic sinusoidal mock client with noise
  - `sim/inject_anomaly.py`: Anomaly injection CLI with predefined scenarios (torque spike, velocity overshoot, etc.)
  - `db/init_db.py`: SQLite schema + UR5e seed data
  - `tests/test_phase1.py`: Automated tests (4/4 passing)
- [Phase 2] Zero-shot anomaly detection & alerts:
  - `services/anomaly_service/detector.py`: Real-time detector (envelope limits + rolling Z-scores)
  - `services/anomaly_service/main.py`: Streaming WebSocket, debouncing & alert dispatching
  - `services/alert_service/main.py`: Alert lifecycle, push WebSocket, safety stops
  - `tests/test_phase2.py`: Automated tests (4/4 passing)
- [Phase 3] RAG Store + Orchestrator:
  - `services/rag_service/store.py`: ChromaDB persistent vector store
  - `services/rag_service/extractor.py`: Text extraction & sliding-window chunking
  - `services/rag_service/main.py`: RAG FastAPI server on port 8003
  - `services/orchestrator/gemini_client.py`: Gemini client (3.6 primary, 3.7 backup) with citations
  - `services/orchestrator/main.py`: Orchestrator FastAPI server on port 8000
  - `data/sample_docs/UR5e_Service_Manual.md`: Sample UR5e documentation for live onboarding
  - `scripts/demo_onboard_docs.py`: Live document onboarding demonstration
  - `tests/test_phase3.py`: Automated tests (4/4 passing)
- [Live Calibration] ProtoTwin integration:
  - Calibrated signal address mapping to the 46 signals from the user's `UR5eReadings` component on port 8084
- [Phase 5 & 6] Audit Logs, Export & Fleet Dashboard:
  - `services/orchestrator/logs_module.py`: Multi-criteria querying, CSV export, ReportLab PDF incident reports
  - `services/orchestrator/main.py`: `GET /logs`, `GET /logs/{id}`, `GET /logs/export/csv`, `GET /logs/export/pdf/{id}`, `GET /machines`, `GET /dashboard/summary`, `GET /fleet/overview`, and chart intent in `POST /chat`
  - `tests/test_phase6.py`: Automated tests for logs, CSV/PDF export, dashboard summary, machines, and chart intent (7/7 passing)

## In progress
- Phase 7: Live showcase demo rehearsal script and end-to-end integration polish.

## Next steps
- Share ready state with frontend developer (all endpoints up and tested).
- Validate live frontend connection against running backend services (`start_services.py`).


## Decisions made
- LLM: Gemini 3.6 Flash (primary), Gemini 3.7 Flash (backup) — user preference, cost-effective
- Anomaly Detection: Hybrid physical envelope (UR5e joint specifications) + zero-shot rolling Z-score. Guarantees immediate zero cold-start detection without waiting for historical training.
- Frontend/backend split: separate branches, merge via PR, clean directory boundaries
- UR5e docs: user will add manually during demo to show real-time onboarding (not pre-bundled)
- DB: SQLite for hackathon simplicity
- Vector DB: Chroma for local in-process / lightweight vector retrieval

## Known issues / blockers
- (none)


## File map
- `prompt.md` — build prompt with phase plan and UI quality bar
- `project.md` — engineering brief with architecture, data model, component specs
- `FRONTEND_SPEC.md` — complete frontend dev brief (pages, API contracts, design system)
- `SHARED_CONTEXT.md` — live coordination file between frontend and backend devs
- `PROGRESS.md` — this file, build progress log
- `.gitignore` — standard ignores for Python/Node/data
