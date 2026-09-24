# Tenure — Build Progress Log

Last updated: 2026-09-25T01:27:00+05:30

## Current phase
Phase 4 — Core UI Integration & Demo Polish

## Status
Phases 0, 1, 2, and 3 are fully completed, integrated, and verified with 12 automated tests passing.
All 4 backend microservices (Orchestrator, Anomaly Service, Alert Service, RAG Service) are fully functional, providing:
1. Real-time telemetry streaming over WebSocket (`ws://localhost:8001/ws/sensors/{machine_id}`)
2. Zero-shot anomaly detection with physical domain limits and dynamic rolling Z-scores
3. Alert lifecycle and safety tiering with WebSocket push (`ws://localhost:8002/ws/alerts/{machine_id}`)
4. Multi-format real-time document onboarding (`POST /ingest` on 8003) and semantic search with source references
5. Grounded AI technician diagnosis (`POST /diagnose` on 8000) using Gemini 3.6/3.7 Flash with citations
6. Interactive technician chat (`POST /chat` on 8000) strictly grounded in manuals
7. Continuous learning feedback loop (`POST /feedback` on 8000) where corrections are re-indexed into the vector store
8. Unified runner `start_services.py` to start all backend services simultaneously

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
- [Phase 3] RAG Store + Orchestrator:
  - `services/rag_service/store.py`: ChromaDB persistent vector store with machine-isolated collections and SQLite metadata mirroring
  - `services/rag_service/extractor.py`: Multi-format text extraction (PDF, Markdown, TXT) and sliding-window chunking with source references
  - `services/rag_service/main.py`: RAG FastAPI server on port 8003 (`/ingest`, `/retrieve`, `/documents/{machine_id}`)
  - `services/orchestrator/gemini_client.py`: Gemini client (Gemini 3.6 Flash primary, 3.7 Flash backup) with strict citation enforcement and grounded fallback
  - `services/orchestrator/main.py`: Orchestrator FastAPI server on port 8000 (`/diagnose`, `/chat`, `/feedback`)
  - `data/sample_docs/UR5e_Service_Manual.md`: Sample UR5e documentation for live demo onboarding
  - `scripts/demo_onboard_docs.py`: End-to-end demonstration script for real-time document onboarding
  - `start_services.py`: Single runner script for launching all 4 backend microservices
  - `tests/test_phase3.py`: Automated test suite for VectorStore, RAG service, Orchestrator diagnosis, chat, and continuous learning feedback loop (4/4 passing)

## In progress
- Ready for Frontend Dev integration (all API contracts active and operational).

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
