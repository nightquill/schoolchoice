# Phase 3: Frontend Stabilization - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a frontend test baseline (Vitest + RTL), decompose StudentProfile into independent tab components, migrate data fetching to TanStack Query, build config-driven auto-generated list views and forms (PLAT-03), adopt shadcn/ui + Tailwind CSS for a polished professional UI, and ensure all pages are mobile-responsive. All existing functionality must continue working throughout.

</domain>

<decisions>
## Implementation Decisions

### StudentProfile Decomposition
- **D-01:** Parent-fetches-all pattern — StudentProfile parent fetches student data via TanStack Query, passes to tabs as props. Tabs are presentational.
- **D-02:** Tab files co-located in `frontend/src/pages/StudentProfile/` — PersonalTab.jsx, GradesTab.jsx, LanguageTab.jsx, EvaluationsTab.jsx, ActivitiesTab.jsx, NotesTab.jsx, PlansTab.jsx alongside the parent.
- **D-03:** Write characterization tests against the monolith BEFORE extracting tabs. Tests serve as the safety net during decomposition.
- **D-04:** Each tab gets a custom hook (usePersonalTab, useGradesTab, etc.) that encapsulates its state logic, keeping tab components presentational.

### Auto-generated UI from Entity Config (PLAT-03)
- **D-05:** Field type → component map registry — a mapping from YAML field types to React components (string→TextInput, enum→Select, date→DatePicker, boolean→Checkbox, jsonb→JSON editor). New types extend the map.
- **D-06:** Backend exposes `GET /api/v1/entities/{name}/schema` that returns the YAML entity config as JSON. Frontend fetches schema at runtime and renders forms/lists dynamically.
- **D-07:** Auto-generated list views are display + navigate-to-detail — list shows rows with key fields, click opens a detail/edit form. No inline editing. Consistent with existing StudentListPage pattern.
- **D-08:** Dynamic nav from entity registry — NavBar reads the list of registered entities from the API and renders links automatically. New entities appear in nav without frontend code changes.

### TanStack Query Migration
- **D-09:** Incremental migration starting with StudentProfile (being decomposed anyway), then spreading to other pages. Both useState/useEffect and TanStack Query patterns coexist temporarily.
- **D-10:** Both queries (useQuery) and mutations (useMutation) — automatic cache invalidation after mutations (e.g., saving a student auto-refreshes the list).
- **D-11:** Shared `<QueryBoundary>` wrapper component — shows LoadingSpinner on pending, ErrorMessage on failure. Consistent loading/error UX across all migrated pages.

### UI Polish and Design System
- **D-12:** Clean and minimal visual direction — generous whitespace, muted colors, clear hierarchy. Linear/Notion-inspired. Professional without flashy. Suits non-technical business owners.
- **D-13:** Adopt shadcn/ui component library (Radix + Tailwind CSS). Replaces/upgrades existing 22 custom components incrementally. Professional, accessible, customizable.
- **D-14:** Tailwind CSS adopted as the styling foundation. Existing plain CSS coexists during migration. Design tokens (colors, spacing, typography) managed via tailwind.config.
- **D-15:** Responsive layout adaptation for mobile — key pages (dashboard, student list, profile) get mobile-optimized layouts with stacked columns, collapsible nav, and touch-friendly targets. Not just "doesn't break" but properly adapted.

### Claude's Discretion
- Vitest + RTL configuration details
- Which characterization tests to write for StudentProfile (prioritize critical user flows)
- TanStack Query key structure and cache invalidation strategy details
- Exact shadcn/ui components to adopt vs. keep from existing component set
- Tailwind config color palette and spacing scale specifics
- Order of page migrations for TanStack Query after StudentProfile
- Dashboard layout for config-driven metrics (UX-06)
- Template switching generalization approach (UX-08)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — Phase 3 covers UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, PLAT-03
- `.planning/PROJECT.md` — Constraints: no Docker, non-technical primary users, stack continuity (React)
- `.planning/ROADMAP.md` — Phase 3 goal and 5 success criteria

### Prior Phase Decisions (carry forward)
- `.planning/phases/01-platform-foundation/01-CONTEXT.md` — Module structure (D-07, D-08), entity YAML format (D-01 through D-06), API consolidation to `/api/v1` (D-11, D-12)
- `.planning/phases/02-ai-provider-abstraction/02-CONTEXT.md` — AI calls through `call_ai()` (D-05), no frontend API changes needed

### Existing Frontend Code (must read before modifying)
- `frontend/src/pages/StudentProfile/StudentProfile.jsx` — The 1,450-line monolith to decompose; tab functions already defined inline
- `frontend/src/components/` — 22 existing UI components (Button, Modal, Tabs, Toast, etc.) to evaluate against shadcn/ui
- `frontend/src/hooks/` — useAuth.js, useToast.js — existing custom hooks pattern
- `frontend/src/api/` — Axios-based API layer to wrap with TanStack Query
- `frontend/src/context/AuthContext.jsx` — Existing auth context provider
- `frontend/package.json` — Current dependencies (React 19, Vite 8, React Router 7, TipTap, no test framework)

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` — Naming patterns and code style
- `.planning/codebase/STRUCTURE.md` — Directory layout
- `.planning/codebase/STACK.md` — Current tech stack

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/Tabs/Tabs.jsx` — Tab navigation component, reusable for StudentProfile decomposition
- `frontend/src/components/LoadingSpinner/` — Existing loading indicator, base for QueryBoundary
- `frontend/src/components/ErrorMessage/` — Existing error display, base for QueryBoundary
- `frontend/src/components/EmptyState/` — Empty state component, reuse for auto-generated list views
- `frontend/src/components/TextInput/` — Existing text input, candidate for shadcn/ui replacement
- `frontend/src/components/Button/` — Existing button, candidate for shadcn/ui replacement
- `frontend/src/components/Modal/` — Existing modal, candidate for shadcn/ui Dialog replacement
- `frontend/src/hooks/useToast.js` — Toast notification hook pattern to follow for new custom hooks

### Established Patterns
- Component directories with co-located files: `ComponentName/ComponentName.jsx`
- API layer in `frontend/src/api/` with separate files per resource (students.js, grades.js, plan.js)
- Axios client instance in `frontend/src/api/client.js` with auth interceptor
- React Router DOM for routing with page-level components in `frontend/src/pages/`

### Integration Points
- `frontend/src/App.jsx` — Route definitions, QueryClientProvider wraps here
- `frontend/src/components/NavBarV2/NavBarV2.jsx` — Navigation, needs dynamic entity links
- `frontend/src/main.jsx` — App entry point, Tailwind CSS import goes here
- `frontend/vite.config.js` — Vitest config extends Vite config, Tailwind PostCSS plugin

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-frontend-stabilization*
*Context gathered: 2026-04-24*
