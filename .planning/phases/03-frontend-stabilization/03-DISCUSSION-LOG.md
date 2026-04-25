# Phase 3: Frontend Stabilization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 03-frontend-stabilization
**Areas discussed:** StudentProfile decomposition, Auto-generated UI from entity config, TanStack Query migration strategy, UI polish and design system

---

## StudentProfile Decomposition

| Option | Description | Selected |
|--------|-------------|----------|
| Keep parent-fetches-all | Parent fetches student data, passes to tabs as props. TanStack Query at parent level. | ✓ |
| Each tab fetches its own data | Tabs are fully independent, each calls its own API. More modular but redundant requests. | |
| Hybrid | Parent fetches core, tabs fetch supplemental data independently. | |

**User's choice:** Keep parent-fetches-all
**Notes:** Simpler, matches current pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| StudentProfile/ directory | Each tab becomes its own file co-located with parent. | ✓ |
| Shared components directory | Tabs go into frontend/src/components/StudentTabs/. | |

**User's choice:** StudentProfile/ directory
**Notes:** Co-located, self-contained.

| Option | Description | Selected |
|--------|-------------|----------|
| Test before extraction | Write characterization tests against monolith first, then extract. | ✓ |
| Test after extraction | Extract first, then write tests per tab. Faster but riskier. | |
| You decide | Claude picks. | |

**User's choice:** Test before extraction
**Notes:** Safety net during decomposition.

| Option | Description | Selected |
|--------|-------------|----------|
| Custom hook per tab | usePersonalTab(), useGradesTab() etc. encapsulate state logic. | ✓ |
| Move hooks as-is | Move existing useState/useEffect into tab files without abstracting. | |
| You decide | Claude picks based on complexity. | |

**User's choice:** Custom hook per tab
**Notes:** Keeps tab components presentational.

---

## Auto-generated UI from Entity Config (PLAT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Field type → component map | Registry maps YAML field types to React components. Extensible. | ✓ |
| Single generic field component | One DynamicField with switch statement. Simpler but harder to customize. | |
| You decide | Claude picks. | |

**User's choice:** Field type → component map
**Notes:** Extensible registry pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| API endpoint serves entity schema | GET /api/v1/entities/{name}/schema returns JSON. Runtime dynamic. | ✓ |
| Build-time code generation | Script reads YAML, generates React files before build. Static. | |
| You decide | Claude picks. | |

**User's choice:** API endpoint serves entity schema
**Notes:** Runtime rendering, no rebuild needed when config changes.

| Option | Description | Selected |
|--------|-------------|----------|
| Display + navigate to detail | List shows rows, click opens detail/edit form. | ✓ |
| Inline editing in list | Click cell to edit in-place. More complex. | |
| You decide | Claude picks. | |

**User's choice:** Display + navigate to detail
**Notes:** Consistent with existing StudentListPage.

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic nav from entity registry | NavBar reads entities from API, renders links automatically. | ✓ |
| Manual nav entries per module | Module config specifies nav items. More control. | |
| You decide | Claude picks. | |

**User's choice:** Dynamic nav from entity registry
**Notes:** New entities appear without code changes.

---

## TanStack Query Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Incremental — start with StudentProfile | Migrate StudentProfile first, spread to other pages. Both patterns coexist. | ✓ |
| All pages in one sweep | Migrate every page in a single pass. Consistent faster but larger blast radius. | |
| You decide | Claude picks migration order. | |

**User's choice:** Incremental — start with StudentProfile
**Notes:** Lower risk, StudentProfile being decomposed anyway.

| Option | Description | Selected |
|--------|-------------|----------|
| Both queries and mutations | useQuery for reads, useMutation for writes. Automatic cache invalidation. | ✓ |
| Queries only, manual mutations | TanStack Query for fetching, keep axios for creates/updates/deletes. | |
| You decide | Claude picks per page. | |

**User's choice:** Both queries and mutations
**Notes:** Full TanStack Query adoption for automatic cache invalidation.

| Option | Description | Selected |
|--------|-------------|----------|
| Shared loading/error wrapper | QueryBoundary component shows LoadingSpinner/ErrorMessage. Consistent UX. | ✓ |
| Per-page handling as-is | Each page handles isLoading/isError inline. Inconsistent. | |
| You decide | Claude picks. | |

**User's choice:** Shared loading/error wrapper
**Notes:** Consistent across all migrated pages.

---

## UI Polish and Design System

| Option | Description | Selected |
|--------|-------------|----------|
| Clean and minimal | Generous whitespace, muted colors, clear hierarchy. Linear/Notion-inspired. | ✓ |
| Data-dense dashboard style | Compact layout, more info visible. Stripe/Grafana-inspired. | |
| Warm and approachable | Rounded corners, softer colors, friendly feel. Basecamp/Todoist-inspired. | |

**User's choice:** Clean and minimal
**Notes:** Professional, suits non-technical business owners.

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt shadcn/ui | Radix + Tailwind component library. Professional, accessible, customizable. | ✓ |
| Polish existing components | Keep 22 custom components, add CSS variables. No new deps. | |
| You decide | Claude picks. | |

**User's choice:** Adopt shadcn/ui
**Notes:** Replaces/upgrades existing components incrementally.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, adopt Tailwind | Required for shadcn/ui. Utility-first CSS, design tokens via config. | ✓ |
| No Tailwind — CSS variables only | Skip shadcn/ui, manual polish with CSS custom properties. | |

**User's choice:** Yes, adopt Tailwind
**Notes:** Required for shadcn/ui. Existing CSS coexists during migration.

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive layout adaptation | Mobile-optimized layouts — stacked columns, collapsible nav, touch targets. | ✓ |
| No-break only | No horizontal overflow at 375px but same desktop layout scaled down. | |
| You decide | Claude determines per page. | |

**User's choice:** Responsive layout adaptation
**Notes:** Properly adapted, not just "doesn't break."

---

## Claude's Discretion

- Vitest + RTL configuration details
- Which characterization tests to write for StudentProfile
- TanStack Query key structure and cache invalidation specifics
- Exact shadcn/ui components to adopt
- Tailwind config color palette and spacing scale
- Page migration order for TanStack Query after StudentProfile
- Dashboard layout for config-driven metrics (UX-06)
- Template switching generalization approach (UX-08)

## Deferred Ideas

None — discussion stayed within phase scope
