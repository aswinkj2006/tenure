# Tenure — Build Progress Log

Last updated: 2026-09-25T01:21:00+05:30

## Current phase
Phase 3 — RAG Store + Orchestrator

## Status
Phases 0, 1, and 2 are fully completed and verified with automated test suites passing.
- Phase 1 (Simulation Foundation): ProtoTwin real & mock clients, anomaly injection CLI, SQLite schema & seed data, virtual environment and test harness.
- Phase 2 (Zero-Shot Anomaly Detection & Alerts): Anomaly detection engine (domain envelopes + rolling Z-score), FastAPI streaming WebSocket at `/ws/sensors/{machine_id}`, Alert service at `/ws/alerts/{machine_id}` with severity tiering and automated safety actions, and persistence into `anomaly_records`.
- Next: Phase 3 (RAG store document ingestion, Chroma vector store, and Gemini 3.6/3.7 Flash orchestrator).

## Completed
- [Phase 0] Project setup: git init, .gitignore, FRONTEND_SPEC.md, SHARED_CONTEXT.md, PROGRESS.md, branch strategy (main/backend/frontend)
- [Phase 1] Simulation foundation:
  - `sim/client.py`: ProtoTwin Connect client wrapper + realistic sinusoidal mock client with noise
  - `sim/inject_anomaly.py`: Anomaly injection CLI with predefined scenarios (torque spike, velocity overshoot, etc.)
  - `db/init_db.py`: SQLite schema (machines, sensor_readings, anomaly_records, diagnoses, feedback, conversation_logs, vector_documents) + UR5e seed data
  - `tests/test_phase1.py`: Automated tests for DB, mock client streaming, anomaly injection, and FastAPI endpoints (4/4 passing)
- [Phase 2] Zero-shot anomaly detection & alerts:
  - `services/anomaly_service/detector.py`: Real-time detector combining physical joint envelope limits and rolling-window statistical Z-scores (zero cold start)
  - `services/anomaly_service/main.py`: FastAPI server streaming telemetry via WebSocket `/ws/sensors/{machine_id}`, evaluating anomalies, debouncing & persisting to `anomaly_records`, and dispatching to alert service
  - `services/alert_service/main.py`: Alert service with WebSocket push `/ws/alerts/{machine_id}`, severity tiering, automatic safety stop triggers, and lifecycle management (acknowledge/resolve)
  - `tests/test_phase2.py`: Automated test suite for physical envelope violations, alert service lifecycle, and end-to-end anomaly detection (4/4 passing)

## In progress
- Phase 3: RAG store setup (Chroma/embeddings) + real-time document onboarding endpoint + Gemini orchestrator for `/diagnose` and `/chat`.

## Next steps
- Build `services/rag_service/store.py` (Chroma vector store + sentence-transformers / Gemini embeddings)
- Build `services/rag_service/main.py` (`/ingest` with live file upload & auto-chunking, `/retrieve`)
- Build `services/orchestrator/main.py` (`/diagnose` with citations + `diagnoses` DB entry, `/chat` with cited responses)
- Test Phase 3 end-to-end with real-time documentation ingestion demo flow

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
