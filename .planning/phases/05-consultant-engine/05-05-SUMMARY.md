---
phase: "05"
plan: "05"
subsystem: consultant-frontend
tags: [sse-streaming, confidence-badge, consultant-page, eventsource, react-components]
dependency_graph:
  requires: [TaskEngine, call_ai_stream, saveConsultantTask]
  provides: [ConsultantTask, SSEStreamDisplay, ConfidenceBadge, consultant.js]
  affects: [App.jsx]
tech_stack:
  added: []
  patterns: [eventsource-sse, ref-based-token-accumulation, responsive-two-column-layout]
key_files:
  created:
    - frontend/src/components/SSEStreamDisplay/SSEStreamDisplay.jsx
    - frontend/src/components/ConfidenceBadge/ConfidenceBadge.jsx
    - frontend/src/api/consultant.js
    - frontend/src/pages/ConsultantTask/ConsultantTask.jsx
  modified:
    - frontend/src/App.jsx
decisions:
  - "Used useRef for token accumulation to avoid stale closure in EventSource done handler"
  - "ConfidenceBadge uses shadcn Popover with hover delay (200ms) and immediate focus trigger"
  - "Mobile layout uses CSS class toggling for chat panel visibility instead of media query in JS"
  - "Chat panel wording updated from Gemini-specific to provider-agnostic (AI_API_KEY)"
metrics:
  duration: "4m 35s"
  completed: "2026-04-28T18:55:29Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 0
  tests_total_passing: 198
---

# Phase 5 Plan 05: Consultant Frontend (SSE streaming, ConfidenceBadge, ConsultantTaskPage) Summary

ConsultantTaskPage with EventSource SSE streaming (ref-based token accumulation to avoid stale closures), ConfidenceBadge with three-tier color-coded Popover tooltips, and consultant API client for save/status/chat endpoints.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create SSEStreamDisplay, ConfidenceBadge, consultant API client | 10a7994 | SSEStreamDisplay.jsx, ConfidenceBadge.jsx, consultant.js |
| 2 | Create ConsultantTaskPage and register route | 4806d92 | ConsultantTask.jsx, App.jsx |

## What Was Built

### SSEStreamDisplay (SSEStreamDisplay.jsx)
Streaming text display component with auto-scroll on new tokens, blinking cursor animation via CSS keyframes, progress indicator ("Generating plan..."), error state with "Try Again" button, and idle state (returns null). Uses role="status" and aria-live="polite" for accessibility. Container has min-height 200px and max-height calc(100vh - 220px).

### ConfidenceBadge (ConfidenceBadge.jsx)
Three-tier badge (HIGH/MEDIUM/LOW) with color-coded styling using CSS variables from tokens.css (--color-success for HIGH, --color-warning for MEDIUM border, --color-error for LOW). Uses shadcn Popover component with 200ms hover delay and immediate focus trigger. HIGH tooltip: "All eligibility data complete." MEDIUM/LOW tooltip lists missing fields. Includes aria-label with tier and tooltip text.

### Consultant API Client (consultant.js)
Four exports following existing plan.js pattern: saveConsultantTask, getConsultantTaskStatus, sendConsultantChat, changeConsultantTemplate. All use axios client import. SSE streaming uses native EventSource (not axios) in the ConsultantTask page.

### ConsultantTaskPage (ConsultantTask.jsx)
Full-page consultant task view replacing polling-based generation with SSE streaming. Key architecture: uses streamTokensRef (useRef) alongside streamTokens state to avoid stale closure in EventSource done handler -- ref accumulates tokens that the done handler reads, while state triggers re-renders. Two-column desktop layout (plan/stream left, chat right at 360px), single-column mobile with collapsible "Show AI Chat" toggle. Toolbar includes Generate Plan, Stop Generation, Export HTML, template selector, section editor. Chat panel uses provider-agnostic wording ("AI_API_KEY" instead of "Gemini API key").

### Route Registration (App.jsx)
Added /students/:id/consultant route with ProtectedRoute wrapper. Existing /students/:id/plan route preserved for backward compatibility during migration.

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Mitigations Implemented

| Threat ID | Mitigation | Location |
|-----------|-----------|----------|
| T-05-16 | Auth token appended as query param for EventSource GET requests | ConsultantTask.jsx handleGenerate() |
| T-05-17 | Plan HTML displayed in iframe with sandbox="allow-same-origin allow-scripts" | ConsultantTask.jsx iframe element |
| T-05-18 | Token in URL accepted for single-user deployment model (documented in plan) | ConsultantTask.jsx EventSource URL construction |

## Known Stubs

None -- all components are fully functional. SSEStreamDisplay renders real token streams. ConfidenceBadge renders real tier data. API client wires to real backend endpoints. ConsultantTask page connects all components with real data flow.

## Verification

- Frontend builds successfully: `npx vite build` completes in 930ms with no errors
- SSEStreamDisplay contains role="status", aria-live="polite", min-height 200px, blinking cursor
- ConfidenceBadge imports Popover, uses CSS variables (--color-success, --color-warning, --color-error)
- ConsultantTask.jsx contains streamTokensRef, EventSource, source.addEventListener('done'), handleStopGeneration
- App.jsx contains both /students/:id/plan and /students/:id/consultant routes
- All 198 existing tests unaffected (no backend changes in this plan)

## Self-Check: PASSED

All 5 files verified on disk. Both task commits verified in git log.
