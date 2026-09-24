# Tenure — Frontend Development Spec

> **This file is for the frontend developer (and their AI assistant).** It defines everything you need to build the UI without needing to read the full backend codebase. The backend developer maintains the API — you build against the contracts below.

---

## Project Overview

**Tenure** is an AI-powered industrial machine monitoring system. Each machine gets an isolated AI "technician" that detects anomalies, diagnoses issues using RAG-grounded LLM reasoning, and learns from human feedback. The demo target is a **UR5e robot arm** simulated in ProtoTwin.

**Your job:** Build a **stunning, award-winning UI** — this needs to look like a funded startup's flagship product, not a hackathon prototype. We're targeting the **Best UI award**.

---

## Pages to Build

### 1. Machine Page (`/machine/:id`) — **Priority 1**

The core page. Shows everything about one machine in real-time.

**Layout (suggested):**
```
┌─────────────────────────────────────────────────────┐
│  [Alert Banner — slides in from top when anomaly]   │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│   Sensor Cards Grid      │   3D Twin Embed          │
│   (2-3 cols, live data)  │   (ProtoTwin iframe)     │
│                          │                          │
├──────────────────────────┴──────────────────────────┤
│                                                     │
│   Chatbot Panel (collapsible / slide-up)            │
│   - Message bubbles (user vs assistant)             │
│   - Citation chips on assistant messages            │
│   - Confirm/Correct buttons after diagnosis         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Components needed:**
- `SensorCard` — shows sensor name, current value, unit, mini sparkline (last ~30 readings). **Teal** when normal, **amber/coral** when anomalous.
- `AlertBanner` — animated slide-in. Severity badge, affected sensors, timestamp. Dismissible but persists in a notification tray.
- `Chatbot` — full chat interface with message bubbles. User messages right-aligned, assistant left-aligned with accent. Citation chips below assistant messages. Input bar with send button. Smooth scroll-to-bottom. After a diagnosis, show "✓ Confirm" / "✗ Correct" buttons — "Correct" opens an inline text input for the actual cause.
- `TwinEmbed` — styled iframe wrapper. Clean border, subtle shadow, responsive aspect ratio. Label overlay with machine name + status indicator (green dot = healthy, amber = warning, red = critical).

**Data sources:**
- Live sensor data: **WebSocket** at `ws://localhost:8001/ws/sensors/{machine_id}`
- Alerts: **WebSocket** at `ws://localhost:8002/ws/alerts/{machine_id}`
- Chat: **REST** `POST /chat` on orchestrator
- Feedback: **REST** `POST /feedback` on orchestrator
- Machine info: **REST** `GET /machines/{machine_id}`

---

### 2. Logs Page (`/logs`) — **Priority 2**

A dedicated page for browsing issue history.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Filter Bar                                         │
│  [Machine ▼] [Date Range] [Severity ▼] [Status ▼]  │
│  [Outcome ▼] [Search...]              [Export CSV]  │
├─────────────────────────────────────────────────────┤
│  Issue List                                         │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🔴 Joint 3 Torque Overload  │ UR5e │ 2h ago│    │
│  │    Severity: Critical  Status: Resolved     │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 🟡 TCP Drift Detected      │ UR5e │ 1d ago│    │
│  │    Severity: Medium    Status: Open         │    │
│  └─────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│  Detail View (drawer/modal when issue clicked)      │
│  - Anomaly data (flagged sensors, deviation)        │
│  - LLM diagnosis with citations                    │
│  - Full conversation transcript (chat bubbles)      │
│  - Final outcome (confirmed/corrected)              │
│  - [Export PDF] button                              │
└─────────────────────────────────────────────────────┘
```

**Components needed:**
- `FilterBar` — machine dropdown, date range picker, severity multi-select, status toggle (open/resolved), outcome toggle (confirmed/corrected). All combinable. Free-text search.
- `IssueRow` — one row per issue. Machine name, timestamp (relative), severity (color-coded badge), status, outcome.
- `IssueDetail` — full record drawer/modal. Sections: anomaly summary, diagnosis (with citation chips), conversation transcript (reuse Chatbot component in read-only mode), outcome/feedback.
- CSV export button (filtered list) + PDF export button (single issue).

**Data sources:**
- Issue list: **REST** `GET /logs?machine_id=&severity=&status=&outcome=&from=&to=&q=`
- Issue detail: **REST** `GET /logs/{anomaly_id}`
- CSV export: **REST** `GET /logs/export/csv?<same filters>`
- PDF export: **REST** `GET /logs/export/pdf/{anomaly_id}`

---

### 3. Fleet Dashboard (`/` or `/dashboard`) — **Priority 3**

Overview page for all machines.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Fleet Stats Bar                                    │
│  [Total Machines: 1] [Active Alerts: 0] [Avg: 94%] │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│  Machine Cards Grid      │  Pinned Charts Area      │
│  (health gauge, name,    │  (chatbot-generated,     │
│   last alert, link)      │   pin/unpin toggle)      │
│                          │                          │
├──────────────────────────┴──────────────────────────┤
│  Dashboard Chatbot                                  │
│  (fleet-wide queries, can generate charts)          │
└─────────────────────────────────────────────────────┘
```

**Components needed:**
- `HealthScoreCard` — circular gauge or radial chart (0–100), animated on change. Color zones: green (80–100), amber (50–79), red (0–49).
- `MachineCard` — shows machine name, health gauge, type, last alert summary, link to machine page.
- `FleetStatsBar` — summary cards across the top.
- `PinnedChart` — renders a chart from structured data (line, bar, area). Pin/unpin toggle. Use **Recharts** or **Chart.js**.
- Reuse `Chatbot` component — but scoped to fleet-wide queries. When the LLM returns a `chart_response`, render it as a `PinnedChart`.

**Data sources:**
- Fleet summary: **REST** `GET /dashboard/summary`
- Machine list: **REST** `GET /machines`
- Chat (with chart intent): **REST** `POST /chat` — response may include `chart_data` field

---

## API Contracts

> **Base URLs:**
> - Anomaly Service: `http://localhost:8001`
> - Alert Service: `http://localhost:8002`
> - RAG Service: `http://localhost:8003`
> - Orchestrator: `http://localhost:8000` ← **this is your main backend**

### Orchestrator API (port 8000)

#### `GET /machines`
Returns all machines.
```json
{
  "machines": [
    {
      "machine_id": "ur5e-001",
      "name": "UR5e Demo Unit",
      "type": "UR5e",
      "install_date": "2025-01-15",
      "status": "online",
      "health_score": 94.2
    }
  ]
}
```

#### `GET /machines/{machine_id}`
Returns single machine detail.
```json
{
  "machine_id": "ur5e-001",
  "name": "UR5e Demo Unit",
  "type": "UR5e",
  "install_date": "2025-01-15",
  "status": "online",
  "health_score": 94.2,
  "active_alerts": 0,
  "total_issues": 12,
  "last_anomaly_at": "2025-09-24T18:30:00Z"
}
```

#### `POST /chat`
Chat with the AI technician.
```json
// Request
{
  "machine_id": "ur5e-001",
  "message": "What could cause joint 3 torque to spike?",
  "anomaly_id": "anom-abc123"  // optional — ties chat to a specific issue
}

// Response
{
  "response": "Based on the UR5e maintenance manual, joint 3 torque spikes are commonly caused by...",
  "citations": [
    {
      "source_ref": "UR5e_Maintenance_Manual.pdf",
      "chunk_text": "Section 4.2: Joint torque monitoring...",
      "page": 47,
      "relevance_score": 0.92
    }
  ],
  "anomaly_id": "anom-abc123",
  "chart_data": null  // or structured chart data if chart intent detected
}
```

**When `chart_data` is present (chart intent detected):**
```json
{
  "response": "Here's the torque trend for joint 3 over the last hour:",
  "citations": [...],
  "chart_data": {
    "chart_type": "line",
    "title": "Joint 3 Torque — Last Hour",
    "x_label": "Time",
    "y_label": "Torque (Nm)",
    "series": [
      {
        "name": "Joint 3 Torque",
        "data": [
          {"x": "2025-09-24T17:30:00Z", "y": 12.4},
          {"x": "2025-09-24T17:35:00Z", "y": 12.8}
        ]
      }
    ],
    "pin_to_dashboard": false
  }
}
```

#### `POST /diagnose`
Auto-diagnose an anomaly (called by the system, but frontend can also trigger it).
```json
// Request
{ "anomaly_id": "anom-abc123" }

// Response
{
  "diagnosis_id": "diag-xyz789",
  "anomaly_id": "anom-abc123",
  "diagnosis": "The joint 3 torque spike of 185 Nm exceeds the UR5e's rated maximum of 150 Nm...",
  "citations": [...],
  "confidence": 0.87,
  "severity": "critical"
}
```

#### `POST /feedback`
Technician confirms or corrects a diagnosis.
```json
// Request
{
  "diagnosis_id": "diag-xyz789",
  "outcome": "corrected",            // "confirmed" or "corrected"
  "confirmed_cause": "Gripper collision with fixture — not a joint failure"  // only if corrected
}

// Response
{ "status": "ok", "feedback_id": "fb-001" }
```

#### `GET /logs`
Query issue logs with filters.
```json
// Query params: ?machine_id=ur5e-001&severity=critical&status=resolved&outcome=confirmed&from=2025-09-01&to=2025-09-25&q=torque&page=1&per_page=20

// Response
{
  "total": 42,
  "page": 1,
  "per_page": 20,
  "issues": [
    {
      "anomaly_id": "anom-abc123",
      "machine_id": "ur5e-001",
      "machine_name": "UR5e Demo Unit",
      "timestamp": "2025-09-24T18:30:00Z",
      "severity": "critical",
      "status": "resolved",
      "outcome": "corrected",
      "flagged_sensors": ["joint_3_torque"],
      "diagnosis_summary": "Joint 3 torque spike exceeding rated maximum..."
    }
  ]
}
```

#### `GET /logs/{anomaly_id}`
Full detail for one issue.
```json
{
  "anomaly_id": "anom-abc123",
  "machine_id": "ur5e-001",
  "machine_name": "UR5e Demo Unit",
  "timestamp": "2025-09-24T18:30:00Z",
  "severity": "critical",
  "status": "resolved",
  "anomaly_data": {
    "flagged_sensors": ["joint_3_torque"],
    "deviation_magnitude": {"joint_3_torque": 2.34},
    "sensor_values_at_flag": {"joint_3_torque": 185.2, "joint_3_velocity": 1.2}
  },
  "diagnosis": {
    "diagnosis_id": "diag-xyz789",
    "text": "The joint 3 torque spike of 185 Nm exceeds...",
    "citations": [...],
    "confidence": 0.87
  },
  "conversation": [
    {"role": "system", "content": "Anomaly detected: joint_3_torque at 185.2 Nm", "ts": "..."},
    {"role": "assistant", "content": "Based on the UR5e manual...", "ts": "...", "citations": [...]},
    {"role": "user", "content": "Could this be a collision?", "ts": "..."},
    {"role": "assistant", "content": "Yes, Section 5.1 describes...", "ts": "...", "citations": [...]}
  ],
  "feedback": {
    "outcome": "corrected",
    "confirmed_cause": "Gripper collision with fixture",
    "ts": "2025-09-24T18:45:00Z"
  }
}
```

#### `GET /logs/export/csv`
Same filters as `GET /logs`. Returns `Content-Type: text/csv` file download.

#### `GET /logs/export/pdf/{anomaly_id}`
Returns `Content-Type: application/pdf` — styled single-issue report.

#### `GET /dashboard/summary`
Fleet-wide aggregation.
```json
{
  "total_machines": 1,
  "machines_online": 1,
  "active_alerts": 0,
  "avg_health_score": 94.2,
  "issues_last_24h": 3,
  "issues_resolved_last_24h": 2
}
```

### WebSocket Contracts

#### Sensor Stream: `ws://localhost:8001/ws/sensors/{machine_id}`
Pushes every ~100ms:
```json
{
  "ts": "2025-09-24T18:30:00.123Z",
  "machine_id": "ur5e-001",
  "sensors": {
    "joint_1_position": 0.523,
    "joint_1_velocity": 0.12,
    "joint_1_torque": 45.2,
    "joint_2_position": -0.891,
    "joint_2_velocity": 0.08,
    "joint_2_torque": 62.1,
    "joint_3_position": 1.204,
    "joint_3_velocity": 0.15,
    "joint_3_torque": 51.8,
    "joint_4_position": 0.0,
    "joint_4_velocity": 0.0,
    "joint_4_torque": 12.3,
    "joint_5_position": -1.571,
    "joint_5_velocity": 0.02,
    "joint_5_torque": 8.7,
    "joint_6_position": 0.0,
    "joint_6_velocity": 0.01,
    "joint_6_torque": 3.2,
    "tcp_x": 0.4,
    "tcp_y": -0.1,
    "tcp_z": 0.3
  }
}
```

#### Alert Stream: `ws://localhost:8002/ws/alerts/{machine_id}`
Pushes when anomaly detected:
```json
{
  "anomaly_id": "anom-abc123",
  "machine_id": "ur5e-001",
  "ts": "2025-09-24T18:30:00Z",
  "severity": "critical",
  "flagged_sensors": ["joint_3_torque"],
  "deviation_magnitude": {"joint_3_torque": 2.34},
  "message": "Joint 3 torque exceeded safe operating threshold",
  "auto_action": "slowdown"
}
```

---

## Design System

> **Goal: Best UI award.** This should look like a $10M startup's flagship product.

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#0D9488` (teal-600) | Primary actions, healthy states, insights |
| `--color-primary-light` | `#14B8A6` (teal-500) | Hover states, accents |
| `--color-primary-dark` | `#0F766E` (teal-700) | Active states, borders |
| `--color-primary-bg` | `#F0FDFA` (teal-50) | Light primary backgrounds |
| `--color-warning` | `#F59E0B` (amber-500) | Warnings, medium severity |
| `--color-warning-bg` | `#FFFBEB` (amber-50) | Warning backgrounds |
| `--color-danger` | `#EF4444` (red-500) | Critical alerts, errors |
| `--color-danger-bg` | `#FEF2F2` (red-50) | Danger backgrounds |
| `--color-success` | `#22C55E` (green-500) | Confirmed, resolved |
| `--color-bg` | `#F8FAFC` (slate-50) | Page background |
| `--color-surface` | `#FFFFFF` | Card/panel backgrounds |
| `--color-border` | `#E2E8F0` (slate-200) | Borders, dividers |
| `--color-text` | `#0F172A` (slate-900) | Primary text |
| `--color-text-secondary` | `#64748B` (slate-500) | Secondary/muted text |
| `--color-text-tertiary` | `#94A3B8` (slate-400) | Hints, placeholders |

### Typography

- **Font:** Inter (Google Fonts) — `font-family: 'Inter', system-ui, -apple-system, sans-serif`
- **Scale:** `h1` 28px/700, `h2` 22px/600, `h3` 18px/600, `body` 15px/400, `caption` 13px/400, `mono` 13px (JetBrains Mono for sensor values)

### Spacing & Radius

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px
- **Border radius:** `--radius-sm` 6px, `--radius-md` 10px, `--radius-lg` 16px, `--radius-xl` 24px
- **Card shadow:** `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- **Elevated shadow:** `0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)`

### Severity Badge Colors

| Severity | Background | Text | Border |
|----------|-----------|------|--------|
| Critical | `#FEF2F2` | `#DC2626` | `#FECACA` |
| High | `#FFF7ED` | `#EA580C` | `#FED7AA` |
| Medium | `#FFFBEB` | `#D97706` | `#FDE68A` |
| Low | `#F0FDFA` | `#0D9488` | `#99F6E4` |

### Micro-Interactions (required, not optional)

- **Alert banner:** slide in from top with `transform: translateY(-100%) → translateY(0)`, 400ms ease-out.
- **Chat messages:** fade in + slide up, 200ms.
- **Sensor card value change:** number morphing animation (count up/down).
- **Severity transitions:** smooth color transitions when a sensor goes from normal → anomalous (300ms).
- **Chatbot expand/collapse:** smooth height transition, 300ms.
- **Hover on cards:** subtle lift (`transform: translateY(-2px)`) + shadow increase.
- **Loading skeletons:** pulse animation on all data-dependent components.
- **Citation chips:** subtle glow on hover, expandable to show full context.

### Loading & Empty States (mandatory)

Every component must handle:
1. **Loading state** — skeleton with pulse animation (not a spinner in the middle of an empty card).
2. **Empty state** — informative message + subtle illustration or icon. Never a blank white space.
3. **Error state** — friendly error message with retry button.

---

## Component Hierarchy

```
App
├── Header / NavBar
│   ├── Logo ("Tenure")
│   ├── Nav: Dashboard | Machine | Logs
│   └── Status indicator (sim connected/disconnected)
│
├── Dashboard (/)
│   ├── FleetStatsBar
│   ├── MachineCard[] → links to /machine/:id
│   ├── PinnedChart[]
│   └── Chatbot (fleet scope)
│
├── MachinePage (/machine/:id)
│   ├── AlertBanner
│   ├── SensorCard[] (grid)
│   ├── TwinEmbed
│   └── Chatbot (machine scope, with confirm/correct)
│
└── LogsPage (/logs)
    ├── FilterBar
    ├── IssueRow[] (list)
    └── IssueDetail (drawer/modal)
```

---

## Tech Recommendations

| Concern | Recommendation |
|---------|---------------|
| Framework | React (Vite) |
| Routing | React Router v6 |
| Styling | Vanilla CSS with CSS custom properties (design tokens above) — NO Tailwind unless you prefer it |
| Charts | Recharts (React-native, composable) |
| Icons | Lucide React (clean, consistent) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| WebSocket | Native WebSocket API or `reconnecting-websocket` |
| HTTP | `fetch` or `axios` |
| Date formatting | `date-fns` |
| PDF trigger | Just hit the backend endpoint and download — backend generates the PDF |

---

## File/Folder Structure (suggested)

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Card.jsx + Card.css
│   │   │   ├── Badge.jsx + Badge.css
│   │   │   ├── Skeleton.jsx + Skeleton.css
│   │   │   ├── Spinner.jsx + Spinner.css
│   │   │   ├── EmptyState.jsx + EmptyState.css
│   │   │   └── ErrorState.jsx + ErrorState.css
│   │   ├── Chatbot/
│   │   │   ├── Chatbot.jsx + Chatbot.css
│   │   │   ├── MessageBubble.jsx
│   │   │   ├── CitationChip.jsx
│   │   │   └── FeedbackControls.jsx
│   │   ├── SensorCard/
│   │   │   ├── SensorCard.jsx + SensorCard.css
│   │   │   └── Sparkline.jsx
│   │   ├── AlertBanner/
│   │   │   └── AlertBanner.jsx + AlertBanner.css
│   │   ├── TwinEmbed/
│   │   │   └── TwinEmbed.jsx + TwinEmbed.css
│   │   ├── HealthScore/
│   │   │   └── HealthScore.jsx + HealthScore.css
│   │   ├── FilterBar/
│   │   │   └── FilterBar.jsx + FilterBar.css
│   │   ├── IssueRow/
│   │   │   └── IssueRow.jsx + IssueRow.css
│   │   ├── IssueDetail/
│   │   │   └── IssueDetail.jsx + IssueDetail.css
│   │   └── Charts/
│   │       └── DynamicChart.jsx + DynamicChart.css
│   ├── pages/
│   │   ├── Dashboard.jsx + Dashboard.css
│   │   ├── MachinePage.jsx + MachinePage.css
│   │   └── LogsPage.jsx + LogsPage.css
│   ├── hooks/
│   │   ├── useWebSocket.js
│   │   ├── useSensors.js
│   │   ├── useAlerts.js
│   │   └── useChat.js
│   ├── api/
│   │   └── client.js          # Centralized fetch/axios wrapper
│   ├── styles/
│   │   ├── tokens.css          # CSS custom properties (design tokens)
│   │   ├── reset.css           # CSS reset / normalize
│   │   └── global.css          # Global styles, font imports
│   ├── utils/
│   │   └── format.js           # Date, number formatting helpers
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js
```

---

## Integration Points (how we merge cleanly)

### Clean Boundary
- **Frontend** lives entirely in `frontend/`. You own everything in this directory.
- **Backend** lives in `services/`, `sim/`, `db/`, `data/`. Backend dev owns these.
- Neither side touches the other's directory.

### API is the Contract
- The API contracts above are the integration surface. If either side needs a change, update `SHARED_CONTEXT.md` first.
- Backend dev will run a mock/real server on the ports listed. Frontend dev can use a simple JSON mock server (`json-server` or MSW) for offline development.

### CORS
- Backend will enable CORS for `http://localhost:5173` (Vite default) on all API endpoints.

### WebSocket Reconnection
- Handle disconnections gracefully — show a subtle "Reconnecting..." banner, auto-reconnect with backoff.

---

## Quality Checklist (before merging)

- [ ] No browser-default styling visible anywhere
- [ ] One consistent design system across all pages
- [ ] Card-based layouts for metrics (no raw HTML tables)
- [ ] Inter font with clear visual hierarchy
- [ ] Smooth micro-interactions on alerts, chat, cards
- [ ] Real chat interface with message bubbles and citation chips
- [ ] Clean 3D twin iframe frame
- [ ] Loading skeletons on every data-dependent component
- [ ] Meaningful empty states on every page
- [ ] Error states with retry
- [ ] Responsive at 1366×768, 1440×900, 1920×1080
- [ ] All filters on logs page are combinable
- [ ] CSV and PDF export buttons work
- [ ] Confirm/Correct feedback flow works in chatbot

---

## Read `SHARED_CONTEXT.md` Before Every Session

Before starting work, always read `SHARED_CONTEXT.md` in the repo root — it's the live coordination file between frontend and backend. It tracks API changes, blockers, and decisions that affect both sides.
