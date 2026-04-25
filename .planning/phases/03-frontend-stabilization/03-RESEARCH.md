# Phase 3: Frontend Stabilization - Research

**Researched:** 2026-04-25
**Domain:** React 19 frontend — Vitest/RTL testing, TanStack Query v5, shadcn/ui + Tailwind CSS v4, component decomposition, config-driven UI generation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### StudentProfile Decomposition
- **D-01:** Parent-fetches-all pattern — StudentProfile parent fetches student data via TanStack Query, passes to tabs as props. Tabs are presentational.
- **D-02:** Tab files co-located in `frontend/src/pages/StudentProfile/` — PersonalTab.jsx, GradesTab.jsx, LanguageTab.jsx, EvaluationsTab.jsx, ActivitiesTab.jsx, NotesTab.jsx, PlansTab.jsx alongside the parent.
- **D-03:** Write characterization tests against the monolith BEFORE extracting tabs. Tests serve as the safety net during decomposition.
- **D-04:** Each tab gets a custom hook (usePersonalTab, useGradesTab, etc.) that encapsulates its state logic, keeping tab components presentational.

#### Auto-generated UI from Entity Config (PLAT-03)
- **D-05:** Field type → component map registry — mapping from YAML field types to React components.
- **D-06:** Backend exposes `GET /api/v1/entities/{name}/schema` returning YAML entity config as JSON. Frontend fetches schema at runtime.
- **D-07:** Auto-generated list views: display + navigate-to-detail. No inline editing.
- **D-08:** Dynamic nav from entity registry — NavBar reads registered entities from API, renders links automatically.

#### TanStack Query Migration
- **D-09:** Incremental migration starting with StudentProfile, then other pages. Both patterns coexist temporarily.
- **D-10:** Both useQuery and useMutation — automatic cache invalidation after mutations.
- **D-11:** Shared `<QueryBoundary>` wrapper component — LoadingSpinner on pending, ErrorMessage on failure.

#### UI Polish and Design System
- **D-12:** Clean and minimal — Linear/Notion-inspired. Professional without flashy.
- **D-13:** Adopt shadcn/ui (Radix + Tailwind CSS). Replaces/upgrades existing 22 custom components incrementally.
- **D-14:** Tailwind CSS as styling foundation. Existing plain CSS coexists during migration.
- **D-15:** Responsive layout adaptation for mobile — key pages get mobile-optimized layouts.

### Claude's Discretion
- Vitest + RTL configuration details
- Which characterization tests to write for StudentProfile (prioritize critical user flows)
- TanStack Query key structure and cache invalidation strategy details
- Exact shadcn/ui components to adopt vs. keep from existing component set
- Tailwind config color palette and spacing scale specifics
- Order of page migrations for TanStack Query after StudentProfile
- Dashboard layout for config-driven metrics (UX-06)
- Template switching generalization approach (UX-08)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Frontend test suite (Vitest + RTL) with characterization tests for critical pages | Vitest 4.1.5 + RTL 16.3.2 confirmed; vite.config.js extension pattern documented |
| UX-02 | StudentProfile.jsx decomposed into independent tab components (7 tabs) | 1450-line monolith analysed; inline tab functions identified; decomposition pattern documented |
| UX-03 | TanStack Query replaces manual useState/useEffect for server state | TanStack Query v5.100.1 confirmed; v5 API patterns (no callbacks in useQuery) documented |
| UX-04 | UI polished — consistent spacing, typography, color system | shadcn/ui init pattern documented; UI-SPEC tokens confirmed as canonical source |
| UX-05 | All pages mobile-responsive | Breakpoints from UI-SPEC (375/768/1024px) confirmed; Tailwind responsive patterns documented |
| UX-06 | Config-driven dashboard layout (3-5 metrics from module config) | EntityRegistry.all_configs() available; dashboard metric rendering pattern documented |
| UX-07 | Rich text editing (TipTap) preserved for any report/plan type | TipTap @tiptap/react 3.21.0 already installed; PlanSectionEditor.jsx confirmed in-place |
| UX-08 | Template switching generalized to any report type | AcademicPlan plan.py template_id column confirmed; SetTemplateRequest schema exists |
| PLAT-03 | Auto-generated frontend forms and list views from entity config | EntityRegistry + yaml_loader analysed; schema endpoint gap (D-06) identified; field type map documented |
</phase_requirements>

---

## Summary

Phase 3 is a substantial frontend overhaul with four distinct work streams: (1) establishing Vitest/RTL as the test baseline with characterization tests before any decomposition, (2) decomposing the 1,450-line StudentProfile monolith into seven presentational tab components with TanStack Query replacing the existing useEffect data fetching, (3) building the config-driven entity UI system (schema API endpoint + EntityListView + EntityForm + dynamic nav), and (4) adopting shadcn/ui + Tailwind CSS for visual polish with mobile responsiveness.

The backend already has `EntityRegistry`, `yaml_loader`, and `crud_generator` in place from Phase 1 — but the schema endpoint `GET /api/v1/entities/{name}/schema` does not yet exist. That endpoint is a Phase 3 backend deliverable. The frontend has no test framework, no TanStack Query, and no Tailwind CSS installed. All of these require Wave 0 install tasks before any feature work.

The most significant risk is the shadcn/ui initialization: the project uses React 19 (released 2024) which shadcn/ui fully supports, but Tailwind CSS v4 (the current `latest` on npm) ships with a radically different configuration model (no `tailwind.config.js`, CSS-first config). shadcn/ui still initializes against Tailwind v3 by default. The plan must install `tailwindcss@^3` explicitly or handle the v4 migration path — mixing v4 with shadcn/ui v0 (current stable) will produce broken output.

**Primary recommendation:** Wave 0 of the plan installs Vitest + RTL, TanStack Query v5, and Tailwind CSS v3 (not v4) with shadcn/ui default style/slate preset. Feature waves proceed in dependency order: test infrastructure → characterization tests → TanStack Query setup → StudentProfile decomposition → shadcn/ui component replacements → entity schema API → EntityListView/EntityForm → dynamic nav → mobile responsive pass.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| StudentProfile data fetch | Frontend Server (React) | API Backend | Parent component owns fetch via TanStack Query; tabs receive props |
| Tab state (active tab, URL hash) | Browser / Client | — | URL search params (`?tab=...`) managed client-side via useSearchParams |
| Tab component state (form fields, saving) | Browser / Client | — | Per-tab custom hooks encapsulate local UI state |
| Server state caching and invalidation | Browser / Client (TanStack Query) | API Backend | QueryClient on client; cache invalidated via mutation callbacks calling `invalidateQueries` |
| Entity schema retrieval (PLAT-03) | API Backend | — | `GET /api/v1/entities/{name}/schema` serializes EntityConfig to JSON |
| Entity list rendering | Browser / Client | API Backend | EntityListView fetches schema + data at runtime from API |
| Dynamic nav entity links | Browser / Client | API Backend | NavBar fetches `GET /api/v1/entities` (list of registered entities) on mount |
| Design tokens / CSS variables | Browser / Client | — | Tailwind config + tokens.css provide the variables; rendered in browser |
| TipTap rich text editing | Browser / Client | — | Client-side editor; content saved to API on submit |
| Mobile responsive layout | Browser / Client | — | CSS breakpoints in Tailwind; no server involvement |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.5 | Test runner (Vite-native, replaces Jest) | [VERIFIED: npm registry] Works inside vite.config.js without separate config file; no transform config needed for JSX |
| @testing-library/react | 16.3.2 | Component rendering in tests | [VERIFIED: npm registry] RTL 16 is React 18/19 compatible; standard for React component tests |
| @testing-library/jest-dom | 6.9.1 | DOM assertion matchers | [VERIFIED: npm registry] Adds `toBeInTheDocument`, `toHaveValue`, etc. |
| @testing-library/user-event | 14.6.1 | Simulate user interactions in tests | [VERIFIED: npm registry] Preferred over `fireEvent` for realistic interaction simulation |
| jsdom | 29.0.2 | Browser DOM simulation for Vitest | [VERIFIED: npm registry] Vitest environment for React component tests |
| @tanstack/react-query | 5.100.1 | Server state management (fetch, cache, sync) | [VERIFIED: npm registry] v5 is current stable; React 19 compatible |
| tailwindcss | 3.4.19 (v3 LTS) | Utility-first CSS framework | [VERIFIED: npm registry] shadcn/ui stable requires v3; v4 breaks shadcn/ui init as of 2026-04 |
| postcss | 8.5.10 | CSS transformation pipeline | [VERIFIED: npm registry] Required peer for Tailwind v3 |
| autoprefixer | 10.5.0 | Vendor prefixes for CSS | [VERIFIED: npm registry] Required peer for Tailwind v3 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | 6.0.1 | JSX fast refresh for Vite | Already installed; confirm test environment picks it up |
| sonner | 2.0.7 | Toast notifications (shadcn/ui Sonner) | Replaces existing Toast.jsx per UI-SPEC component table |
| lucide-react | latest stable | Icon set (default for shadcn/ui) | Used in shadcn components and any new icons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind CSS v3 | Tailwind CSS v4 | v4 has CSS-first config, incompatible with shadcn/ui init; use v3 until shadcn/ui v1 releases official v4 support |
| TanStack Query v5 | SWR or React Query v4 | v5 is current; v4 API differs (callbacks moved to mutation options); stay on v5 |
| RTL + Vitest | Playwright component tests | Playwright is for E2E; RTL is correct for unit/characterization; project has no E2E setup |
| shadcn/ui default style | shadcn/ui new-york style | "default" matches rounded-md, matches tokens.css border-radius-md (6px) better |

**Installation (Wave 0):**
```bash
# Test infrastructure
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# TanStack Query
npm install @tanstack/react-query

# Tailwind CSS v3 (explicit v3 — not v4)
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui initialization (after Tailwind installed)
npx shadcn@latest init

# shadcn components (install per-wave as needed)
npx shadcn@latest add button dialog tabs input card table select sonner
```

**Version verification:** [VERIFIED: npm registry 2026-04-25]
- `@tanstack/react-query` latest: 5.100.1
- `vitest` latest: 4.1.5
- `@testing-library/react` latest: 16.3.2
- `tailwindcss` v3-lts: 3.4.19, latest (v4): 4.2.4 — **use `tailwindcss@^3`**
- `sonner` latest: 2.0.7

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React App (Browser)                      │
│                                                             │
│  App.jsx                                                    │
│  ├── QueryClientProvider (TanStack Query)                   │
│  └── Routes                                                 │
│       ├── /students/:id/profile                             │
│       │    └── StudentProfile (parent)                      │
│       │         ├── useQuery("student", GET /students/:id)  │
│       │         └── Tabs                                    │
│       │              ├── PersonalTab ← usePersonalTab()     │
│       │              ├── GradesTab ← useGradesTab()         │
│       │              └── ... (7 tabs total)                 │
│       ├── /entities/:name       (PLAT-03)                   │
│       │    └── EntityListView                               │
│       │         ├── useQuery("schema/:name")                │
│       │         └── useQuery("entities/:name")              │
│       └── /entities/:name/:id  (PLAT-03)                   │
│            └── EntityForm                                   │
│                 └── field type → component map              │
│                                                             │
│  QueryBoundary (wraps data regions)                         │
│  ├── pending → <LoadingSpinner />                           │
│  ├── error   → <ErrorMessage /> + "Try again" refetch       │
│  └── success → children                                     │
│                                                             │
│  NavBarV2                                                   │
│  └── useQuery("entities") → GET /api/v1/entities            │
│       → dynamic entity links appended                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (Axios client.js)
┌────────────────────────▼────────────────────────────────────┐
│                    FastAPI Backend                            │
│                                                             │
│  /api/v1/students/:id                (existing)             │
│  /api/v1/entities                    (NEW — list all)       │
│  /api/v1/entities/:name/schema       (NEW — PLAT-03 D-06)   │
│  /api/v1/{entity.table}              (auto-generated CRUD)  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    EntityRegistry (singleton)                │
│  registry.all_configs() → list[EntityConfig]                │
│  registry.get_config(name) → EntityConfig                   │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (new additions only)

```
frontend/src/
├── pages/StudentProfile/
│   ├── StudentProfile.jsx        # Parent — TanStack Query fetch, passes props
│   ├── PersonalTab.jsx           # Presentational tab
│   ├── GradesTab.jsx
│   ├── LanguageTab.jsx
│   ├── EvaluationsTab.jsx
│   ├── ActivitiesTab.jsx
│   ├── NotesTab.jsx
│   └── PlansTab.jsx
├── pages/EntityListPage/
│   └── EntityListPage.jsx        # Auto-generated list view (PLAT-03)
├── pages/EntityDetailPage/
│   └── EntityDetailPage.jsx      # Auto-generated detail/edit form (PLAT-03)
├── components/QueryBoundary/
│   └── QueryBoundary.jsx         # TanStack Query loading/error wrapper
├── components/EntityListView/
│   └── EntityListView.jsx        # Renders shadcn/ui Table from entity schema
├── components/EntityForm/
│   └── EntityForm.jsx            # Renders form fields from entity schema
├── hooks/
│   ├── usePersonalTab.js         # Per-tab state hook
│   ├── useGradesTab.js
│   ├── useLanguageTab.js
│   ├── useEvaluationsTab.js
│   ├── useActivitiesTab.js
│   ├── useNotesTab.js
│   └── usePlansTab.js
├── api/
│   └── entities.js               # GET /entities, GET /entities/:name/schema
└── test/
    └── setup.js                  # RTL + jest-dom global setup
```

### Pattern 1: Vitest Configuration (extends vite.config.js)

**What:** Vitest is configured inside `vite.config.js` via a `test` key — no separate vitest.config file needed. `setupFiles` runs `@testing-library/jest-dom/extend-expect`.

**When to use:** Always — single config file keeps dev and test transforms in sync.

```javascript
// vite.config.js — Source: Vitest docs (vitest.dev/config)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
```

```javascript
// src/test/setup.js
import '@testing-library/jest-dom'
```

### Pattern 2: Characterization Test Pattern (before decomposition)

**What:** A "characterization test" locks the current observable behavior of a component before refactoring. It does NOT test that the code is correct — it tests what the code currently does, so any change that breaks behavior is caught.

**When to use:** Immediately — write these against the StudentProfile monolith before extracting any tab.

```javascript
// StudentProfile.test.jsx — characterization test (locks current behavior)
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import StudentProfile from './StudentProfile'

// Mock the API layer — never call the network in unit tests
vi.mock('../../api/students', () => ({
  getStudent: vi.fn().mockResolvedValue({ id: '1', full_name: 'Test Student' }),
  graduateStudent: vi.fn(),
}))
vi.mock('../../api/account', () => ({ getAccount: vi.fn().mockResolvedValue({}) }))
vi.mock('../../api/grades', () => ({
  getGrades: vi.fn().mockResolvedValue([]),
  createGrade: vi.fn(),
  deleteGrade: vi.fn(),
  getSubjects: vi.fn().mockResolvedValue([]),
}))
// ... mock remaining imports

const wrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/students/1/profile']}>
        <Routes>
          <Route path="/students/:id/profile" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

test('renders 7 tabs', async () => {
  render(<StudentProfile />, { wrapper })
  expect(await screen.findByRole('tab', { name: 'Personal' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Grades' })).toBeInTheDocument()
  // ... verify all 7
})

test('Personal tab is active by default', async () => {
  render(<StudentProfile />, { wrapper })
  expect(await screen.findByRole('tab', { name: 'Personal', selected: true })).toBeInTheDocument()
})
```

### Pattern 3: TanStack Query v5 — Key Structure and QueryBoundary

**What:** TanStack Query v5 changed the API — `useQuery` no longer accepts `onSuccess`/`onError` callbacks inline; use `useMutation` side effects or `useEffect` watching query state for those patterns. QueryClient wraps the app in `App.jsx`. `invalidateQueries` after a mutation ensures the list/detail stays fresh.

**When to use:** All new data fetching in Phase 3.

**CRITICAL v5 difference from v4:** `useQuery` does NOT accept `onSuccess`/`onError` options. Side effects on fetch go in `useEffect` watching `data`/`error`. [VERIFIED: TanStack Query v5 migration guide]

```javascript
// App.jsx — add QueryClientProvider once, at the root
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>...</BrowserRouter>
    </QueryClientProvider>
  )
}
```

```javascript
// StudentProfile.jsx — parent-fetches-all (D-01)
import { useQuery } from '@tanstack/react-query'
import { getStudent } from '../../api/students'

export default function StudentProfile() {
  const { id } = useParams()
  const { data: student, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id),
  })

  return (
    <QueryBoundary isLoading={isLoading} isError={isError} error={error} refetch={refetch}>
      <PersonalTab student={student} studentId={id} />
    </QueryBoundary>
  )
}
```

```javascript
// QueryBoundary.jsx — shared wrapper (D-11)
export default function QueryBoundary({ isLoading, isError, error, refetch, children, resourceName = 'data' }) {
  if (isLoading) return <div style={{ padding: '48px 0', textAlign: 'center' }}><LoadingSpinner /></div>
  if (isError) return (
    <ErrorMessage message={`Something went wrong loading ${resourceName}.`}>
      <button onClick={() => refetch()} style={{ color: 'var(--color-primary)' }}>Try again</button>
    </ErrorMessage>
  )
  return children
}
```

```javascript
// useMutation with cache invalidation (D-10)
import { useMutation, useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: (payload) => updateStudent(studentId, payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['student', studentId] })
    showToast('Profile saved.', 'success')
  },
  onError: () => showToast('Failed to save. Please try again.', 'error'),
})
```

### Pattern 4: shadcn/ui Initialization (Tailwind v3)

**What:** shadcn/ui `npx shadcn@latest init` generates `components.json`, updates `tailwind.config.js`, and injects CSS variables into `index.css`. The existing `tokens.css` values must be copied over the generated CSS variables.

**When to use:** Wave 0, before any component work. Must run `init` once.

```bash
# After installing tailwindcss@^3
npx shadcn@latest init
# Prompts: style=default, base color=slate, CSS variables=yes
```

Generated CSS variables in `index.css` (`:root` block) must be overridden to match `tokens.css`:
```css
/* Override shadcn defaults with project tokens */
:root {
  --background: 248 250 252;    /* #F8FAFC */
  --foreground: 15 23 42;       /* #0F172A */
  --primary: 37 99 235;         /* #2563EB */
  --destructive: 220 38 38;     /* #DC2626 */
  /* etc. — map each token.css value */
}
```

### Pattern 5: Entity Schema API (PLAT-03 backend gap)

**What:** `GET /api/v1/entities/{name}/schema` and `GET /api/v1/entities` are new backend endpoints that do not exist yet. They must be added in Phase 3 Wave 0 alongside the frontend install wave.

```python
# backend/app/api/v1/routes/entities.py (new file)
from fastapi import APIRouter, HTTPException
from app.platform.entity_registry import registry

router = APIRouter(prefix="/entities", tags=["entities"])

@router.get("", status_code=200)
def list_entities():
    """Return list of all registered entity names and labels."""
    return [{"name": c.name, "table": c.table} for c in registry.all_configs()]

@router.get("/{name}/schema", status_code=200)
def get_entity_schema(name: str):
    """Return entity config as JSON for frontend schema-driven rendering (D-06)."""
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
    return {
        "name": config.name,
        "table": config.table,
        "fields": [
            {
                "name": f.name,
                "type": f.type,
                "required": f.required,
                "choices": f.choices,
                "max_length": f.max_length,
            }
            for f in config.fields
        ],
    }
```

This router must be registered in `main.py`.

### Pattern 6: Field Type → Component Map (D-05)

**What:** A registry mapping YAML field types to React form components. Centralised so new types extend the map without touching form rendering logic.

```javascript
// components/EntityForm/fieldComponents.js
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

export const FIELD_COMPONENT_MAP = {
  string:   ({ field, value, onChange }) => <Input id={field.name} value={value ?? ''} onChange={e => onChange(e.target.value)} />,
  text:     ({ field, value, onChange }) => <textarea id={field.name} value={value ?? ''} onChange={e => onChange(e.target.value)} />,
  int:      ({ field, value, onChange }) => <Input type="number" id={field.name} value={value ?? ''} onChange={e => onChange(Number(e.target.value))} />,
  decimal:  ({ field, value, onChange }) => <Input type="number" step="0.01" id={field.name} value={value ?? ''} onChange={e => onChange(parseFloat(e.target.value))} />,
  date:     ({ field, value, onChange }) => <Input type="date" id={field.name} value={value ?? ''} onChange={e => onChange(e.target.value)} />,
  boolean:  ({ field, value, onChange }) => <Checkbox id={field.name} checked={!!value} onCheckedChange={onChange} />,
  enum:     ({ field, value, onChange }) => (/* Select with field.choices */),
  jsonb:    ({ field, value, onChange }) => <textarea id={field.name} value={value ? JSON.stringify(value, null, 2) : ''} onChange={e => { try { onChange(JSON.parse(e.target.value)) } catch {} }} />,
}
```

### Anti-Patterns to Avoid

- **Installing Tailwind v4 (latest):** `npm install tailwindcss` will install v4 as of 2026-04. shadcn/ui init against v4 produces a broken setup — must use `tailwindcss@^3` explicitly.
- **useQuery onSuccess/onError (TanStack Query v5):** These options were removed in v5. Using them produces TypeScript errors and silent failures in JavaScript. Use `useEffect` watching `data`/`error` or `useMutation` side effects.
- **Writing characterization tests after decomposition:** The safety net is only valuable if written first. Tests written after extraction only test the new code, not the original behavior contract.
- **QueryClientProvider inside a component:** Must be placed once at the App root, not inside a page component — otherwise the cache is destroyed on navigation.
- **Importing from `components/ui/` before shadcn init:** shadcn generates the `components/ui/` directory only after `npx shadcn@latest init`. Running the executor before init produces import errors.
- **CSS variable names mismatch:** shadcn/ui uses HSL-space variables (`--primary: 37 99 235` without `hsl()`). Do not paste `#2563EB` directly into shadcn variables — convert to HSL components.
- **Skipping `tailwind.config.js` content array:** Tailwind v3 purges unused classes. If `content` does not include `./src/**/*.{jsx,js}`, all utility classes are stripped in production build.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading / error boundaries for data fetching | Custom loading state machine | TanStack Query + QueryBoundary | Query handles stale-while-revalidate, background refetch, retry, deduplication |
| Toast notification system | Custom event-based toast | Sonner (shadcn/ui) | Handles stacking, dismiss timers, accessibility announcements out of the box |
| Accessible dialog / modal | Custom focus trap | shadcn/ui Dialog (Radix) | Focus trap, Escape, aria-labelledby, scroll lock — all already implemented |
| Accessible tabs | Custom keyboard nav | shadcn/ui Tabs (Radix) | Arrow key nav, aria-selected, aria-controls — already implemented; existing Tabs.jsx will be replaced |
| Form input styling | Custom styled inputs | shadcn/ui Input / Select / Checkbox | Consistent visual + focus ring + accessible label binding |
| Query cache invalidation | setTimeout + refetch | `queryClient.invalidateQueries` | Invalidation is atomic, handles race conditions, avoids stale data |

**Key insight:** The existing 22 custom components are already solving these problems acceptably — the value of shadcn/ui is primarily visual consistency and accessibility polish, not replacing business logic. Do not re-implement component behavior; replace the primitive rendering.

---

## Common Pitfalls

### Pitfall 1: Tailwind v4 / shadcn/ui Incompatibility

**What goes wrong:** Developer runs `npm install tailwindcss` (gets v4), then `npx shadcn@latest init`. The init script detects v4 but generates a v3-style `tailwind.config.js`, or fails with "Cannot find module 'tailwindcss/resolveConfig'" errors at build time.

**Why it happens:** `tailwindcss` `latest` tag is v4.2.4 as of April 2026. shadcn/ui stable (v0.x) was designed for Tailwind v3. The shadcn team is working on v4 support but it is not stable as of this research date.

**How to avoid:** Always install `tailwindcss@^3` (maps to 3.4.19). Check with `npm list tailwindcss` after install.

**Warning signs:** `tailwind.config.js` is empty or has only `content: []`; Tailwind classes not applying in development; `@layer utilities` missing from CSS output.

### Pitfall 2: TanStack Query v5 API Breaking Changes from v4

**What goes wrong:** Code copied from v4 examples uses `useQuery({ onSuccess, onError })` — these options exist in v4 but throw type errors in v5 TypeScript and silently do nothing in v5 JavaScript.

**Why it happens:** The v5 migration removed inline query callbacks to simplify the mental model. v4 examples are still prevalent in search results and AI training data.

**How to avoid:** After `getStudent` query, use `useEffect` if you need a side effect on data change:
```javascript
const { data } = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id) })
useEffect(() => { if (data) doSomethingWith(data) }, [data])
```

**Warning signs:** Data loads successfully but a toast or state update expected after fetch does not trigger.

### Pitfall 3: Tabs Component — Tab Panel Rendering All Children

**What goes wrong:** The existing `Tabs.jsx` renders tab panels with `hidden={!isActive}` but the children prop is shared — only the active tab's `children` renders. After decomposition, each tab needs to pass its own children, not share a single `children` block.

**Why it happens:** The current monolith renders only the active tab's JSX inline. After decomposition, the parent must conditionally render the correct tab component, not pass all tabs as one `children` block.

**How to avoid:** The parent renders a switch on active tab:
```javascript
const tabContent = {
  personal: <PersonalTab student={student} studentId={id} />,
  grades: <GradesTab student={student} studentId={id} />,
  // ...
}
<Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab}>
  {tabContent[activeTab]}
</Tabs>
```

Or, after replacing with shadcn/ui Tabs, use the `<TabsContent value="personal">` pattern which handles this correctly.

### Pitfall 4: characterization tests failing on async data loads

**What goes wrong:** Test renders StudentProfile and immediately asserts on content — but the component shows a loading spinner while API calls resolve, so `getByText('Personal')` throws "unable to find element" before data arrives.

**Why it happens:** All the StudentProfile data fetching is async. `render()` returns synchronously, before any `useEffect` or query callback fires.

**How to avoid:** Always use `findBy*` (returns a promise, waits up to 1 second) or wrap assertions in `waitFor()`:
```javascript
expect(await screen.findByRole('tab', { name: 'Personal' })).toBeInTheDocument()
```

### Pitfall 5: shadcn components.json path aliases

**What goes wrong:** `npx shadcn@latest init` prompts for a components alias. If the project has no path aliases configured in `vite.config.js`, shadcn installs components to `@/components/ui/` but imports fail at runtime because Vite does not resolve `@/`.

**Why it happens:** The project currently uses relative imports (`../../components/`) with no `@` alias. shadcn expects one.

**How to avoid:** During `shadcn init`, when asked for the components alias, answer with a relative path (e.g. `src/components`) OR configure the `@` alias in `vite.config.js` before running init:
```javascript
// vite.config.js — add resolve.alias
import path from 'path'
resolve: {
  alias: { '@': path.resolve(__dirname, './src') }
}
```
Recommend adding the alias — it will be needed anyway once shadcn components import each other.

### Pitfall 6: Polling intervals leaking after tab switch (GradesTab)

**What goes wrong:** The existing StudentProfile monolith has polling in the GradesTab for transcript parsing. After decomposition, if the interval is created in a hook but the cleanup function is missing or the hook is unmounted mid-poll, the interval fires on an unmounted component, producing "Warning: Can't perform a React state update on an unmounted component."

**Why it happens:** The polling logic uses `useRef` for the interval handle, but the `useEffect` cleanup must explicitly call `clearInterval(intervalRef.current)`.

**How to avoid:** Any new `useGradesTab` hook that includes polling must follow the transferable-skills pattern (Skill #4): `useRef` for handle + `useEffect` return cleanup.

---

## Code Examples

### Vitest Global Setup
```javascript
// src/test/setup.js — Source: testing-library.com/docs/react-testing-library/setup
import '@testing-library/jest-dom'
```

### TanStack Query v5 — QueryClient at App root
```javascript
// App.jsx addition — Source: tanstack.com/query/v5/docs/framework/react/quick-start
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})
// Wrap BrowserRouter: <QueryClientProvider client={queryClient}>
```

### Tailwind content config
```javascript
// tailwind.config.js — Source: tailwindcss.com/docs/content-configuration
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

### Tailwind import in main.jsx
```javascript
// main.jsx — add before other imports
import './index.css'  // index.css must contain @tailwind directives
```

```css
/* index.css — add at top (before existing rules) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 `onSuccess`/`onError` in useQuery | Removed in v5; use `useEffect` or `useMutation` options | TanStack Query v5.0 (Oct 2023) | All v4 examples in training data are wrong for v5 |
| Tailwind v3 JS config (`tailwind.config.js`) | Tailwind v4 CSS-first config (`@import "tailwindcss"`) | Tailwind v4.0 (Jan 2025) | shadcn/ui still requires v3; use v3 explicitly |
| Jest for React testing | Vitest (Vite-native) | 2022–2023 ecosystem shift | No transform config needed; runs inside Vite |
| RTL `fireEvent` | `userEvent` from `@testing-library/user-event` | v14 (2022) | userEvent simulates real browser events (bubbling, focus); fireEvent is lower-level |

**Deprecated / outdated:**
- `@testing-library/react` `act()` manual wrapping: RTL 13+ wraps most interactions automatically; rarely needed.
- TanStack Query v4 DevTools: `@tanstack/react-query-devtools` has a v5 version — use `@tanstack/react-query-devtools@^5` if added.

---

## Runtime State Inventory

> Rename/refactor phase: not applicable. This is a greenfield addition phase. No runtime state is renamed. Omitting this section.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite, npm scripts | ✓ | v20.20.1 | — |
| npm | package installation | ✓ | 10.8.2 | — |
| Vite | frontend dev/build | ✓ (installed) | 8.0.1 | — |
| @vitejs/plugin-react | Vitest JSX support | ✓ (installed) | 6.0.1 | — |
| PostgreSQL | backend API calls during dev | ✓ (Homebrew) | 15.x | — |
| Python 3.9+ | backend dev server | [ASSUMED] available | — | Cannot run without it |
| Uvicorn | backend ASGI | [ASSUMED] available | — | Cannot run without it |

**Missing dependencies (require Wave 0 install):**
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` — not installed, no fallback, required for UX-01
- `@tanstack/react-query` — not installed, no fallback, required for UX-03
- `tailwindcss@^3`, `postcss`, `autoprefixer` — not installed, no fallback, required for UX-04/D-13
- shadcn/ui `components.json` — does not exist, required for D-13 (confirmed by UI-SPEC `shadcn_initialized: false`)

**Missing backend endpoints (require Wave 0 backend work alongside frontend installs):**
- `GET /api/v1/entities` — does not exist, required for D-08 (dynamic nav)
- `GET /api/v1/entities/{name}/schema` — does not exist, required for D-06/PLAT-03

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + React Testing Library 16.3.2 |
| Config file | `frontend/vite.config.js` (extend with `test:` key) — Wave 0 |
| Quick run command | `cd frontend && npx vitest run --reporter=dot` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Vitest + RTL configured, characterization tests exist | setup | `cd frontend && npx vitest run` | ❌ Wave 0 |
| UX-02 | StudentProfile renders 7 tabs; tab switch does not reload page | unit | `cd frontend && npx vitest run src/pages/StudentProfile/` | ❌ Wave 0 |
| UX-02 | Each tab component renders in isolation (PersonalTab, GradesTab, etc.) | unit | `cd frontend && npx vitest run` | ❌ Wave 0 |
| UX-03 | QueryBoundary shows LoadingSpinner when isLoading=true | unit | `cd frontend && npx vitest run src/components/QueryBoundary/` | ❌ Wave 0 |
| UX-03 | QueryBoundary shows ErrorMessage + Try Again when isError=true | unit | `cd frontend && npx vitest run src/components/QueryBoundary/` | ❌ Wave 0 |
| PLAT-03 | EntityListView renders table columns from schema | unit | `cd frontend && npx vitest run src/components/EntityListView/` | ❌ Wave 0 |
| PLAT-03 | EntityForm renders correct input type for each field type | unit | `cd frontend && npx vitest run src/components/EntityForm/` | ❌ Wave 0 |
| UX-05 | No horizontal overflow at 375px | manual | Browser devtools / Playwright (no Playwright setup) | Manual only |
| UX-07 | TipTap PlanSectionEditor still renders after shadcn migration | unit | `cd frontend && npx vitest run src/components/PlanSectionEditor/` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run --reporter=dot`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full frontend suite green + 60 backend tests green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend/vite.config.js` — add `test:` block (environment: jsdom, globals: true, setupFiles)
- [ ] `frontend/src/test/setup.js` — `import '@testing-library/jest-dom'`
- [ ] `frontend/src/pages/StudentProfile/StudentProfile.test.jsx` — characterization tests (UX-01 + UX-02)
- [ ] `frontend/src/components/QueryBoundary/QueryBoundary.test.jsx` — boundary states (UX-03)
- [ ] Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`
- [ ] Install: `npm install @tanstack/react-query`
- [ ] Install: `npm install -D tailwindcss@^3 postcss autoprefixer`
- [ ] Run: `npx tailwindcss init -p` (generates tailwind.config.js + postcss.config.js)
- [ ] Run: `npx shadcn@latest init` (generates components.json, updates index.css)
- [ ] Backend: create `backend/app/api/v1/routes/entities.py` + register in main.py (D-06, D-08)

---

## Security Domain

> `security_enforcement` key absent from config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (no new auth flows in Phase 3) | Existing JWT via `useAuth` / `get_current_user` |
| V3 Session Management | No | Existing `AuthContext.jsx` unchanged |
| V4 Access Control | Yes — new entity endpoints | `Depends(get_current_user)` on all new entity routes (D-06 entity schema + list endpoints) |
| V5 Input Validation | Yes — EntityForm accepts user input | shadcn/ui Input + required field enforcement from entity config `required: true` |
| V6 Cryptography | No | No crypto changes |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated entity schema endpoint | Information Disclosure | Add `Depends(get_current_user)` to `GET /api/v1/entities/{name}/schema` and `GET /api/v1/entities` |
| XSS via EntityForm JSON field (JSONB input rendered unsanitized) | Tampering | Always render EntityForm output through React's virtual DOM — no `dangerouslySetInnerHTML`; raw JSON editor does not execute code |
| Auto-generated CRUD list leaks private entity data | Information Disclosure | All auto-generated CRUD routes already require `get_current_user` (verified in `crud_generator.py`) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Python 3.9+ and uvicorn are available in the development environment | Environment Availability | Backend dev server cannot start; entity schema endpoint unreachable during frontend dev |
| A2 | shadcn/ui `npx shadcn@latest init` supports React 19 without compatibility flags | Standard Stack | Init may fail with peer dependency warnings; workaround: `--legacy-peer-deps` |
| A3 | URL hash (`#personal`) or search param (`?tab=personal`) update on tab switch is the correct deep-linking approach | Architecture Patterns | If URL should not change on tab switch, the Tabs component does not need `useSearchParams` integration — check existing StudentProfile.jsx uses `useSearchParams` (confirmed in CONTEXT.md code context note) |

> A3 note: Confirmed by CONTEXT.md code_context section mentioning `useSearchParams` is the existing pattern in StudentProfile. [VERIFIED: codebase read]

---

## Open Questions (RESOLVED)

1. **shadcn/ui React 19 peer dep warning**
   - What we know: React 19.2.4 is installed; shadcn/ui components depend on Radix primitives which declare peer deps for React 16–18
   - What's unclear: Whether `npm install` will fail with peer dep conflicts or proceed with a warning
   - RESOLVED: Use `--legacy-peer-deps` if peer dep conflict occurs during `npm install`. All Radix primitives are known to work at runtime with React 19.

2. **`auto_crud: false` on student.yaml**
   - What we know: `student.yaml` has `auto_crud: false`, meaning the auto-generated CRUD router is NOT mounted for students — the existing hand-written students route handles student CRUD
   - What's unclear: Whether the entity schema endpoint should still serve student.yaml (it should, for completeness of the entity registry API)
   - RESOLVED: Schema endpoint returns all entities regardless of `auto_crud`; nav shows only `auto_crud: true` entities to avoid duplicating the existing students nav link (see 03-04 T3).

3. **TipTap v3 (3.21.0) + React 19 compatibility**
   - What we know: TipTap @tiptap/react 3.21.0 is already installed and presumably working
   - What's unclear: Whether adding Tailwind and shadcn/ui affects TipTap's CSS
   - RESOLVED: Test PlanSectionEditor after shadcn init; add ProseMirror CSS overrides in index.css if needed. RTL test added in 03-06 T2 to catch rendering breakage.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry 2026-04-25] — @tanstack/react-query@5.100.1, vitest@4.1.5, @testing-library/react@16.3.2, tailwindcss (v3-lts: 3.4.19, latest: 4.2.4), sonner@2.0.7
- [VERIFIED: codebase read] — StudentProfile.jsx (1450 lines), entity_registry.py, crud_generator.py, yaml_loader.py, vite.config.js, frontend/package.json
- [VERIFIED: codebase read] — 03-UI-SPEC.md (design tokens, component inventory, interaction contracts)
- [VERIFIED: codebase read] — tokens.css (canonical design tokens), skills/frontend-engineer.md, skills/ui-designer.md

### Secondary (MEDIUM confidence)
- [CITED: tanstack.com/query/v5] — TanStack Query v5 API changes (onSuccess/onError removed from useQuery)
- [CITED: vitest.dev/config] — Vitest configuration via vite.config.js `test:` key
- [CITED: ui.shadcn.com] — shadcn/ui init, component list, Tailwind v3 requirement

### Tertiary (LOW confidence)
- [ASSUMED] — shadcn/ui stable (v0.x) does not yet have a stable Tailwind v4 integration path as of April 2026; based on known timeline of shadcn v4 work and npm dist-tag state

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Architecture: HIGH — all patterns verified against existing codebase code and locked decisions from CONTEXT.md
- Pitfalls: HIGH — Tailwind v3/v4 split verified via npm dist-tags; TanStack Query v5 API verified via documentation; others verified via codebase analysis
- Validation: HIGH — existing backend tests confirmed (60 tests per MEMORY.md); frontend test setup fully specified

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days — npm ecosystem; shadcn/ui Tailwind v4 support status may change)
