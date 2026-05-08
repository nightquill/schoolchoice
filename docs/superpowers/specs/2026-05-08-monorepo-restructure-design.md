# Monorepo Restructure Design

**Date:** 2026-05-08
**Status:** Approved
**Driver:** Infrastructure prep — establish monorepo structure so future products slot in cleanly. No second product is imminent.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Workspace tooling | pnpm workspaces (no Turborepo) | One frontend consumer; Turborepo adds complexity without benefit yet. Layer on later if build times warrant it. |
| Shared package scope | `@schoolchoice/ui` | Matches repo name. Rename if a broader brand emerges. |
| Shared package contents | Design system + platform concerns (auth, API client, layout) | One package gives future apps the full "logged-in app shell." Split into separate packages later if it grows unwieldy. |
| Backend restructure | None — stays as `backend/` at repo root | Python doesn't benefit from JS workspaces. Internal `platform/` vs `modules/` separation already exists. |
| Build strategy | Source package (no separate build step) | Only consumer is `apps/web/` (Vite). Vite transpiles workspace imports directly. No bundler config needed in `packages/ui/`. |

---

## Directory Structure

```
schoolchoice/
├── pnpm-workspace.yaml          # defines workspace packages
├── package.json                  # root scripts (dev, build, lint)
├── .npmrc                        # pnpm config
│
├── apps/
│   └── web/                      # @schoolchoice/web — the school_choice frontend
│       ├── package.json
│       ├── src/
│       │   ├── App.jsx
│       │   ├── main.jsx
│       │   ├── index.css
│       │   ├── pages/            # all route pages
│       │   ├── components/       # domain-specific components only
│       │   ├── api/              # domain-specific API hooks
│       │   ├── hooks/            # domain-specific hooks
│       │   └── utils/
│       ├── public/
│       ├── index.html
│       ├── vite.config.js
│       ├── tailwind.config.js
│       ├── postcss.config.cjs
│       ├── eslint.config.js
│       └── tests/                # Playwright + unit tests
│
├── packages/
│   └── ui/                       # @schoolchoice/ui — shared design system + platform
│       ├── package.json
│       └── src/
│           ├── index.js          # barrel export
│           ├── components/       # generic UI: Button, Modal, Toast, Tabs, etc.
│           ├── primitives/       # shadcn/ui base components
│           ├── context/          # AuthContext
│           ├── hooks/            # useAuth, useApi, shared hooks
│           ├── api/              # axios client base, API utilities
│           ├── layout/           # NavBarV2, app shell
│           └── lib/              # cn(), tailwind-merge helpers
│
├── backend/                      # unchanged — Python FastAPI
│   ├── app/
│   ├── tests/
│   ├── scripts/
│   └── requirements.txt
│
└── ...                           # existing root files (docs, data, etc.)
```

---

## Package Split

### → `packages/ui/` (shared)

Generic, reusable components and platform concerns that any future app would need:

- **shadcn/ui primitives:** everything currently in `components/ui/`
- **Generic components:** Button, Modal, Toast, Tabs, EmptyState, LoadingSpinner, TextInput, ErrorMessage, StatusChip, FormCard, FilterControl, SearchFilterBar, QueryBoundary, StarRating, ActionBar, FileUpload, ValidationSummary
- **Layout:** NavBarV2, app shell
- **Auth:** AuthContext, useAuth hook
- **API:** axios client base, shared API configuration
- **Lib:** `cn()`, `tailwind-merge` helpers

### → `apps/web/` (domain-specific)

Everything specific to the school_choice product:

- **All pages** (`pages/`)
- **Domain components:** StudentForm, StudentRow, RecommendationCard, SchoolCard, ImportWizard, ColumnMapper, PlanSectionEditor, ActionPlanDisplay, SSEStreamDisplay, ShapSummary, TemplateSelector, ConfidenceBadge, EligibilityBadge, PredictedGradeBadge
- **Domain API hooks:** student endpoints, plan endpoints, match endpoints, etc.
- **App.jsx, routing, main.jsx**

### Classification rule

A component goes in `packages/ui/` if it could be used unchanged in an app that has nothing to do with school admissions. Everything else stays in `apps/web/`.

---

## Package Configuration

### `packages/ui/package.json`

```json
{
  "name": "@schoolchoice/ui",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.js",
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  }
}
```

No build step. `main` points to source. Vite in `apps/web/` transpiles it.

### `apps/web/package.json`

```json
{
  "name": "@schoolchoice/web",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "@schoolchoice/ui": "workspace:*",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    ...
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `.npmrc`

```ini
shamefully-hoist=true
```

### Root `package.json`

```json
{
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @schoolchoice/web dev",
    "build": "pnpm --filter @schoolchoice/web build",
    "lint": "pnpm -r lint",
    "test:frontend": "pnpm --filter @schoolchoice/web test"
  }
}
```

---

## Build & Tooling Config

### Tailwind (`apps/web/tailwind.config.js`)

Add `packages/ui/` to the content paths:

```js
content: [
  './index.html',
  './src/**/*.{js,jsx}',
  '../../packages/ui/src/**/*.{js,jsx}',
],
```

### Vite (`apps/web/vite.config.js`)

No special config needed — pnpm workspace resolution handles `@schoolchoice/ui` imports. Vite follows the symlink and transpiles the source.

### Vercel (`vercel.json`)

Update to point to `apps/web/` as the build root:

```json
{
  "buildCommand": "cd ../.. && pnpm install && pnpm build",
  "outputDirectory": "dist",
  "installCommand": "cd ../.. && pnpm install",
  "framework": null,
  "rootDirectory": "apps/web"
}
```

Or set the root directory in Vercel project settings to `apps/web` and configure install/build commands to run from the repo root.

---

## Migration Strategy

This is a file-move refactor. No component code changes beyond import paths.

### Steps

1. Install pnpm, initialize workspace — root config files
2. Create `packages/ui/` — package.json, directory structure, barrel export
3. Move shared components from `frontend/src/` to `packages/ui/src/`
4. Create `apps/web/` — move remaining frontend files
5. Update all import paths in `apps/web/` — old relative paths become `@schoolchoice/ui` imports
6. Update build config — Tailwind content paths, Vercel config
7. Remove old `frontend/` directory
8. Verify — dev server starts, app works identically, existing tests pass

### What stays untouched

- `backend/` — completely unchanged
- All Python code, tests, scripts
- Git history preserved (moves, not deletes+creates)

### Risk mitigation

The main risk is broken import paths. Every moved file's old import path will be mechanically found (grep) and replaced. No logic changes in any component.

---

## Future Expansion

When a second product is needed:
1. Create `apps/new-product/` with its own Vite config
2. Add `@schoolchoice/ui` as a dependency
3. Get auth, layout, API client, and the full component library for free

When `@schoolchoice/ui` grows too large:
- Split into `@schoolchoice/ui` (components only) and `@schoolchoice/platform` (auth, API, layout)
- Internal restructure, no app-level changes needed since barrel exports stay the same

When build times warrant it:
- Add Turborepo at the root for build caching and task pipelines
- Drop-in addition, no structural changes required
