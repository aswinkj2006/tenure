# Tenure — Shared Context

> **Both frontend and backend developers: read this file before every work session.** Update it after every commit that changes the integration surface (APIs, data shapes, ports, environment, decisions).

Last updated: 2026-09-25T00:50:00+05:30

---

## Current State

| Area | Status | Owner |
|------|--------|-------|
| Backend services | Not started | Backend dev (Aswin) |
| Frontend UI | Completed (v2.1 Atmosphere & Motion: Living backdrop, Frosted glass system, 3D Bloom/Vignette, Cmd+K palette, NumberFlow digits, 6-DOF Heatmap) | Frontend dev |
| ProtoTwin sim | Not started | Backend dev (Aswin) |
| Integration | Ready on frontend side | Both |

---

## Active API Contracts

> Canonical API contracts are defined in `FRONTEND_SPEC.md`. This section tracks **changes** to those contracts.

### Service Ports (current)

| Service | Port | Status |
|---------|------|--------|
| Orchestrator | 8000 | Not running |
| Anomaly Service | 8001 | Not running |
| Alert Service | 8002 | Not running |
| RAG Service | 8003 | Not running |
| Frontend (Vite) | 5173 | Not running |

### API Changes Log

| Date | Change | Affected Endpoints | Who Changed | Frontend Impact |
|------|--------|--------------------|-------------|-----------------|
| — | (none yet) | — | — | — |

---

## Decisions Made

| # | Decision | Reason | Date | Who |
|---|----------|--------|------|-----|
| 1 | LLM: Gemini 2.5 Flash (primary), Gemini 2.5 Flash as backup | Cost-effective, fast, good quality | 2026-09-25 | Aswin |
| 2 | Frontend and backend in separate branches, merge via PR | Clean separation, parallel development | 2026-09-25 | Aswin |
| 3 | UR5e docs added manually by user during demo (not pre-bundled) | Demonstrates real-time onboarding flow | 2026-09-25 | Aswin |

---

## Environment Setup

### Backend Requirements
```
Python 3.11+
FastAPI + uvicorn
Qdrant or Chroma (vector DB)
google-genai (Gemini API)
sentence-transformers (embeddings)
Time-series foundation model (TBD — Chronos/MOMENT/TimesFM)
ProtoTwin Connect Python client
SQLite (hackathon DB)
```

### Frontend Requirements
```
Node.js 18+
React (Vite)
See FRONTEND_SPEC.md for full library recommendations
```

### Environment Variables (shared)
```env
# Backend
GEMINI_API_KEY=<your-key>
LLM_MODEL=gemini-2.5-flash
LLM_BACKUP_MODEL=gemini-2.5-flash
VECTOR_DB=qdrant  # or chroma
DATABASE_URL=sqlite:///./tenure.db

# Frontend
VITE_API_URL=http://localhost:8000
VITE_WS_SENSORS_URL=ws://localhost:8001/ws/sensors
VITE_WS_ALERTS_URL=ws://localhost:8002/ws/alerts
```

---

## Branch Strategy

```
main          ← stable, merged code only
├── backend   ← Aswin: services/, sim/, db/, data/, config files
└── frontend  ← Frontend dev: frontend/ directory only
```

### Rules
1. **Never commit directly to `main`** — merge via PR only.
2. **Backend branch** owns: `services/`, `sim/`, `db/`, `data/`, `docker-compose.yml`, root config files.
3. **Frontend branch** owns: `frontend/` directory entirely.
4. **Shared files** (this file, `FRONTEND_SPEC.md`, `PROGRESS.md`, `prompt.md`, `project.md`) — either side can update, but **always pull before editing** to avoid conflicts.
5. Before merging a PR, both sides should verify `SHARED_CONTEXT.md` is up to date.

### Merge Flow
```
backend ──PR──→ main ←──PR── frontend
```
Since `backend` and `frontend` touch entirely different directories, merges should be conflict-free. The only potential conflict zone is `SHARED_CONTEXT.md` and `PROGRESS.md` — resolve these manually if needed.

---

## Blockers & Issues

| # | Issue | Owner | Status | Notes |
|---|-------|-------|--------|-------|
| — | (none yet) | — | — | — |

---

## What's Available for Frontend Right Now

> Frontend dev: check this section to know what backend endpoints you can actually call vs what you need to mock.

| Endpoint | Available? | Mock suggested? |
|----------|-----------|----------------|
| `GET /machines` | ❌ | Yes — hardcode 1 UR5e machine |
| `GET /machines/:id` | ❌ | Yes |
| `POST /chat` | ❌ | Yes — return static cited response |
| `POST /diagnose` | ❌ | Yes |
| `POST /feedback` | ❌ | Yes — return `{status: "ok"}` |
| `GET /logs` | ❌ | Yes — return sample issue list |
| `GET /logs/:id` | ❌ | Yes — return sample full issue |
| `WS sensors` | ❌ | Yes — generate random sensor values |
| `WS alerts` | ❌ | Yes — trigger on button press |
| `GET /dashboard/summary` | ❌ | Yes |

---

## Commit Convention

Use conventional commits so both sides can scan history quickly:

```
feat(backend): add /chat endpoint with citation support
feat(frontend): build SensorCard component with sparkline
fix(backend): correct WebSocket reconnection on sim restart
chore: update SHARED_CONTEXT.md with new API change
docs: update FRONTEND_SPEC.md — added chart_data field
```

---

## Update Instructions

**After every commit that affects the other side:**
1. Pull latest `SHARED_CONTEXT.md` from `main` (or the other branch).
2. Update the relevant section (API changes, decisions, blockers, availability).
3. Commit with `chore: update SHARED_CONTEXT.md — <what changed>`.

**After every work session:**
1. Update the "Current State" table at the top.
2. Update the "What's Available for Frontend" table.
3. Log any new decisions or blockers.
