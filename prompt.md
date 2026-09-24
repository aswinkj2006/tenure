# Tenure — Build Prompt for Coding Agent

You are building **Tenure** — a system where each industrial machine gets an isolated AI "technician" (anomaly detection + per-machine knowledge store) reasoned over by a shared LLM, demoed against a simulated UR5e robot in ProtoTwin.

**Before writing any code**, read `tenure-engineering-brief.md` in full — it defines the architecture, tech stack, repo structure, data model, and component specs. This document tells you *how to execute that build* phase by phase, the UI quality bar to hit, and how to maintain context across sessions in case of a handoff.

## Context log requirement — read this before doing anything else

Maintain a single file at the repo root: **`/PROGRESS.md`**

This exists so that if this build is handed off to a different agent or a new session mid-way, that agent can resume exactly where you left off without re-deriving context or redoing work. Treat this as a hard requirement, not a nice-to-have.

**On starting work:**
- Check if `/PROGRESS.md` exists. If it does, read it fully before touching any code. Do not restart, second-guess, or redo work it says is already done — trust the log.
- If it doesn't exist, create it now using the template below and treat yourself as starting Phase 1.

**While working:**
- Update `/PROGRESS.md` immediately after completing each phase — not just at the very end of a session.
- Update it immediately after any significant decision (choosing a library, changing a data model field, deviating from the plan in this document) — future-you or a different agent needs to know *why*, not just *what*.
- Update it before ending your turn or session, even if a phase is only partially finished — log the real, partial state accurately. An inaccurate "done" is worse than an honest "half done."
- Never delete prior history from this file — append and update status, don't wipe it. The full trail across handoffs matters.

**Template for `/PROGRESS.md`:**
```
# Tenure — Build Progress Log

Last updated: <ISO timestamp>

## Current phase
<Phase number and name>

## Status
<One paragraph: what's working right now, what's demoable if the demo happened this second>

## Completed
- [Phase 1] <summary>
- [Phase 2] <summary>

## In progress
- <specific file/task> — <current state> — <what's left>

## Next steps
- <concrete next action, in order of priority>

## Decisions made
- <decision> — <reason>

## Known issues / blockers
- <issue> — <what's been tried, what hasn't>

## File map
- <path> — <what it does>
```

## UI/UX quality bar

This needs to look like a funded startup's real product, not a hackathon prototype thrown together overnight. Concrete requirements, not vibes:

- **No default styling** — no unstyled HTML tables, no browser-default form inputs, no default button styling anywhere visible in the demo.
- **One consistent design system** across every page (dashboard, machine page, chatbot, logs page): pick a primary accent color and a small palette, and reuse it — don't let each page invent its own look. Suggested mapping, consistent with the architecture's own color logic: teal for calm/normal/insight states, amber or coral for alerts/anomalies, neutral gray for structural UI.
- **Card-based layouts** for metrics and health scores — not raw tables.
- **Clean typography**: one sans-serif font family throughout (e.g. Inter or a solid system font stack), with a clear visual hierarchy between headers, body text, and secondary/muted text.
- **Subtle micro-interactions**: smooth transitions when an alert appears or a chat message arrives. Restraint over flashiness — this should feel calm and trustworthy, not gamified.
- **A real chat interface** for the chatbot — message bubbles with a clear visual distinction between user and assistant, not a plain textarea with output dumped below it.
- **A clean frame around the 3D twin embed** — it should look intentionally placed, not like a raw, borderless iframe dropped on the page.
- **Loading and empty states everywhere** — never leave a blank screen while data loads; use skeleton states or spinners. An empty logs page before any issue has occurred should say something, not show nothing.
- Responsive enough to not visibly break at different window sizes on a laptop during the demo. Full mobile support is not required.
- Dark mode is a nice-to-have if time allows — do not spend phase time on it before the core flow works.

## Phase-by-phase plan

Build UI polish *within* each phase, not as a separate pass at the end — a phase isn't done until it looks like the quality bar above, not just until it functions.

**Phase 1 — Simulation foundation**
- ProtoTwin UR5e model + Python client via ProtoTwin Connect, streaming joint/TCP values.
- A script to manually trigger an anomaly (e.g. force an out-of-range joint torque or velocity).
- Acceptance: live sensor values visible/logged from the running sim.

**Phase 2 — Zero-shot anomaly detection**
- Wire the pretrained time-series foundation model to the live stream.
- Acceptance: triggering the anomaly script correctly flags a deviation and writes an `anomaly_records` entry.

**Phase 3 — RAG store + orchestrator**
- Ingest the UR5e's official documentation into the vector store.
- Build the `/diagnose` and `/chat` endpoints, both returning citations.
- Acceptance: given a triggered anomaly, an API call returns a cited diagnosis (no UI needed yet).

**Phase 4 — Core UI: the machine page**
- Live sensor readings view, alert banner, styled chatbot panel, 3D twin embed.
- Acceptance: the full flow is visible in-browser — sim runs, anomaly triggers, alert appears, technician chats with the LLM, diagnosis with citation is shown — and it already meets the UI quality bar, not a placeholder version of it.

**Phase 5 — Feedback loop + conversation logging**
- Confirm/correct control on the diagnosis in the UI.
- `conversation_logs` populated from the full chat transcript.
- A second anomaly injection that visibly demonstrates the retrieval-augmented response improving.
- Acceptance: the "it got smarter" moment is demoable live, end to end.

**Phase 6 — Logs page**
- List view with combinable filters (machine, date range, severity, status, outcome) and a detail view showing the full per-issue record (anomaly + diagnosis + conversation + feedback).
- CSV export for the filtered list, PDF export for a single issue.
- Acceptance: a specific past issue can be found, opened, and exported.

**Phase 7 — Fleet dashboard**
- Health/efficiency score cards, chatbot-generated charts with pin/unpin.
- Acceptance: looks like a real product overview page, not a debug dump of numbers.

**Phase 8 — Final polish pass**
- Consistency audit across every page against the UI quality bar above.
- Verify all loading/empty states are handled.
- Full run-through of the demo script end to end, at least twice.

## Rules while executing

- Don't skip ahead to a later phase before the current phase's acceptance criteria are met, unless explicitly told to reprioritize.
- If blocked (a library issue, an unclear requirement, a design decision with no obvious right answer), log it under "Known issues / blockers" in `/PROGRESS.md` rather than silently guessing and pressing forward — a wrong silent guess costs more time later than a logged blocker costs now.
- Keep changes reasonably scoped per phase so a mid-phase handoff is still traceable from the log and the code both.