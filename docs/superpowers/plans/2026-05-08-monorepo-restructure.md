# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repository into a pnpm workspace monorepo with a shared `@schoolchoice/ui` package and an `apps/web/` application, preserving all existing functionality.

**Architecture:** pnpm workspaces at root with two workspace dirs: `apps/*` and `packages/*`. The shared UI package (`@schoolchoice/ui`) is a source package — no build step, Vite transpiles directly. The Python backend stays at `backend/` outside the JS workspace. All file moves use `git mv` to preserve history.

**Tech Stack:** pnpm workspaces, Vite, React 19, Tailwind CSS, shadcn/ui

---

## File Structure

### New files to create

```
pnpm-workspace.yaml                    # workspace definition
.npmrc                                 # pnpm config
package.json                           # root scripts (replaces existing)
packages/ui/package.json               # @schoolchoice/ui manifest
packages/ui/src/index.js               # barrel export
apps/web/package.json                  # @schoolchoice/web manifest
apps/web/components.json               # shadcn config (updated paths)
```

### Files to move (git mv)

```
# Shared → packages/ui/src/
frontend/src/components/ui/*            → packages/ui/src/primitives/
frontend/src/components/ActionBar/      → packages/ui/src/components/ActionBar/
frontend/src/components/Button/         → packages/ui/src/components/Button/
frontend/src/components/ColumnMapper/   → packages/ui/src/components/ColumnMapper/
frontend/src/components/ConfidenceBadge/ → packages/ui/src/components/ConfidenceBadge/
frontend/src/components/EligibilityBadge/ → packages/ui/src/components/EligibilityBadge/
frontend/src/components/EmptyState/     → packages/ui/src/components/EmptyState/
frontend/src/components/ErrorMessage/   → packages/ui/src/components/ErrorMessage/
frontend/src/components/FileUpload/     → packages/ui/src/components/FileUpload/
frontend/src/components/FilterControl/  → packages/ui/src/components/FilterControl/
frontend/src/components/FormCard/       → packages/ui/src/components/FormCard/
frontend/src/components/LoadingSpinner/ → packages/ui/src/components/LoadingSpinner/
frontend/src/components/Modal/          → packages/ui/src/components/Modal/
frontend/src/components/NavBar/         → packages/ui/src/components/NavBar/
frontend/src/components/PredictedGradeBadge/ → packages/ui/src/components/PredictedGradeBadge/
frontend/src/components/QueryBoundary/  → packages/ui/src/components/QueryBoundary/
frontend/src/components/SearchFilterBar/ → packages/ui/src/components/SearchFilterBar/
frontend/src/components/StarRating/     → packages/ui/src/components/StarRating/
frontend/src/components/StatusChip/     → packages/ui/src/components/StatusChip/
frontend/src/components/Tabs/           → packages/ui/src/components/Tabs/
frontend/src/components/TemplateSelector/ → packages/ui/src/components/TemplateSelector/
frontend/src/components/TextInput/      → packages/ui/src/components/TextInput/
frontend/src/components/Toast/          → packages/ui/src/components/Toast/
frontend/src/lib/utils.js              → packages/ui/src/lib/utils.js
frontend/src/context/AuthContext.jsx    → packages/ui/src/context/AuthContext.jsx
frontend/src/hooks/useAuth.js           → packages/ui/src/hooks/useAuth.js
frontend/src/hooks/useToast.js          → packages/ui/src/hooks/useToast.js
frontend/src/api/client.js             → packages/ui/src/api/client.js
frontend/src/api/account.js            → packages/ui/src/api/account.js
frontend/src/api/auth.js               → packages/ui/src/api/auth.js

# App → apps/web/
frontend/src/App.jsx                   → apps/web/src/App.jsx
frontend/src/main.jsx                  → apps/web/src/main.jsx
frontend/src/index.css                 → apps/web/src/index.css
frontend/src/utils/                    → apps/web/src/utils/
frontend/src/assets/                   → apps/web/src/assets/
frontend/src/test/                     → apps/web/src/test/
frontend/src/pages/                    → apps/web/src/pages/
frontend/src/components/NavBarV2/      → apps/web/src/components/NavBarV2/
frontend/src/components/ActionPlanDisplay/ → apps/web/src/components/ActionPlanDisplay/
frontend/src/components/EntityForm/    → apps/web/src/components/EntityForm/
frontend/src/components/EntityListView/ → apps/web/src/components/EntityListView/
frontend/src/components/ImportWizard/  → apps/web/src/components/ImportWizard/
frontend/src/components/PlanSectionEditor/ → apps/web/src/components/PlanSectionEditor/
frontend/src/components/RecommendationCard/ → apps/web/src/components/RecommendationCard/
frontend/src/components/SchoolCard/    → apps/web/src/components/SchoolCard/
frontend/src/components/ShapSummary/   → apps/web/src/components/ShapSummary/
frontend/src/components/SSEStreamDisplay/ → apps/web/src/components/SSEStreamDisplay/
frontend/src/components/StudentForm/   → apps/web/src/components/StudentForm/
frontend/src/components/StudentRow/    → apps/web/src/components/StudentRow/
frontend/src/components/ValidationSummary/ → apps/web/src/components/ValidationSummary/
frontend/src/api/students.js           → apps/web/src/api/students.js
frontend/src/api/cohorts.js            → apps/web/src/api/cohorts.js
frontend/src/api/schools.js            → apps/web/src/api/schools.js
frontend/src/api/schoolsV2.js          → apps/web/src/api/schoolsV2.js
frontend/src/api/targets.js            → apps/web/src/api/targets.js
frontend/src/api/plan.js               → apps/web/src/api/plan.js
frontend/src/api/match.js              → apps/web/src/api/match.js
frontend/src/api/grades.js             → apps/web/src/api/grades.js
frontend/src/api/analytics.js          → apps/web/src/api/analytics.js
frontend/src/api/transcripts.js        → apps/web/src/api/transcripts.js
frontend/src/api/recommendations.js    → apps/web/src/api/recommendations.js
frontend/src/api/consultant.js         → apps/web/src/api/consultant.js
frontend/src/api/entities.js           → apps/web/src/api/entities.js
frontend/src/api/admin.js              → apps/web/src/api/admin.js
frontend/src/api/methodology.js        → apps/web/src/api/methodology.js
frontend/src/api/actionPlan.js         → apps/web/src/api/actionPlan.js
frontend/src/hooks/useGradesTab.js     → apps/web/src/hooks/useGradesTab.js
frontend/src/hooks/useActivitiesTab.js → apps/web/src/hooks/useActivitiesTab.js
frontend/src/hooks/usePersonalTab.js   → apps/web/src/hooks/usePersonalTab.js
frontend/src/hooks/useLanguageTab.js   → apps/web/src/hooks/useLanguageTab.js
frontend/src/hooks/useEvaluationsTab.js → apps/web/src/hooks/useEvaluationsTab.js
frontend/src/hooks/useNotesTab.js      → apps/web/src/hooks/useNotesTab.js
frontend/src/hooks/usePlansTab.js      → apps/web/src/hooks/usePlansTab.js

# Build config → apps/web/
frontend/index.html                    → apps/web/index.html
frontend/vite.config.js                → apps/web/vite.config.js
frontend/tailwind.config.js            → apps/web/tailwind.config.js
frontend/postcss.config.cjs            → apps/web/postcss.config.cjs
frontend/eslint.config.js              → apps/web/eslint.config.js
frontend/public/                       → apps/web/public/
frontend/tests/                        → apps/web/tests/
frontend/.env                          → apps/web/.env
frontend/.env.example                  → apps/web/.env.example
frontend/.gitignore                    → apps/web/.gitignore
```

### Files to delete after move

```
frontend/                              # entire directory removed after all moves
```

### Files to modify (import path updates)

Every file in `apps/web/src/` that imports from relative paths pointing to now-moved shared components must be updated to import from `@schoolchoice/ui`. Every file in `packages/ui/src/` that uses relative paths to other files within the package must have paths updated to the new internal structure.

---

### Task 1: Install pnpm and create workspace config

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Modify: `package.json` (root)
- Modify: `.gitignore`

- [ ] **Step 1: Install pnpm globally**

Run: `npm install -g pnpm`
Expected: pnpm installed successfully

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create .npmrc**

```ini
shamefully-hoist=true
```

- [ ] **Step 4: Update root package.json**

Replace the current root `package.json` (which only has playwright) with:

```json
{
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @schoolchoice/web dev",
    "build": "pnpm --filter @schoolchoice/web build",
    "lint": "pnpm --filter @schoolchoice/web lint",
    "preview": "pnpm --filter @schoolchoice/web preview"
  },
  "devDependencies": {
    "playwright": "^1.59.1"
  }
}
```

- [ ] **Step 5: Add .superpowers/ to .gitignore**

Append to `.gitignore`:

```
# Superpowers brainstorm sessions
.superpowers/
```

- [ ] **Step 6: Create workspace directories**

Run: `mkdir -p apps/web/src apps/web/public packages/ui/src`

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml .npmrc package.json .gitignore
git commit -m "chore: initialize pnpm workspace config

Root workspace with apps/* and packages/* directories.
shamefully-hoist=true for compatibility with shadcn/ui."
```

---

### Task 2: Create @schoolchoice/ui package scaffold

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/src/index.js`

- [ ] **Step 1: Create packages/ui/package.json**

```json
{
  "name": "@schoolchoice/ui",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.js",
  "module": "src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./primitives/*": "./src/primitives/*",
    "./api/*": "./src/api/*",
    "./context/*": "./src/context/*",
    "./hooks/*": "./src/hooks/*",
    "./lib/*": "./src/lib/*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "axios": "^1.13.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.11.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0"
  }
}
```

- [ ] **Step 2: Create packages/ui/src/index.js (placeholder)**

```js
// @schoolchoice/ui — barrel export
// Components, primitives, context, hooks, and API client
// Populated after file moves in Tasks 3-4.
export {};
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/package.json packages/ui/src/index.js
git commit -m "chore: scaffold @schoolchoice/ui package

Source package — no build step. Vite transpiles directly via
workspace resolution."
```

---

### Task 3: Move shared files to packages/ui/

**Files:**
- Move: all shared components, primitives, lib, context, hooks, API base (see file structure above)

This task uses `git mv` for every file to preserve git history. No import path changes yet — those come in Task 6.

- [ ] **Step 1: Move shadcn/ui primitives**

```bash
cd /Users/bsg/Downloads/schoolchoice
mkdir -p packages/ui/src/primitives
git mv frontend/src/components/ui/badge.jsx packages/ui/src/primitives/badge.jsx
git mv frontend/src/components/ui/button.jsx packages/ui/src/primitives/button.jsx
git mv frontend/src/components/ui/card.jsx packages/ui/src/primitives/card.jsx
git mv frontend/src/components/ui/dialog.jsx packages/ui/src/primitives/dialog.jsx
git mv frontend/src/components/ui/dropdown-menu.jsx packages/ui/src/primitives/dropdown-menu.jsx
git mv frontend/src/components/ui/input.jsx packages/ui/src/primitives/input.jsx
git mv frontend/src/components/ui/popover.jsx packages/ui/src/primitives/popover.jsx
git mv frontend/src/components/ui/progress.jsx packages/ui/src/primitives/progress.jsx
git mv frontend/src/components/ui/select.jsx packages/ui/src/primitives/select.jsx
git mv frontend/src/components/ui/separator.jsx packages/ui/src/primitives/separator.jsx
git mv frontend/src/components/ui/sonner.jsx packages/ui/src/primitives/sonner.jsx
git mv frontend/src/components/ui/table.jsx packages/ui/src/primitives/table.jsx
git mv frontend/src/components/ui/tabs.jsx packages/ui/src/primitives/tabs.jsx
```

- [ ] **Step 2: Move shared components**

```bash
cd /Users/bsg/Downloads/schoolchoice
mkdir -p packages/ui/src/components
git mv frontend/src/components/ActionBar packages/ui/src/components/ActionBar
git mv frontend/src/components/Button packages/ui/src/components/Button
git mv frontend/src/components/ColumnMapper packages/ui/src/components/ColumnMapper
git mv frontend/src/components/ConfidenceBadge packages/ui/src/components/ConfidenceBadge
git mv frontend/src/components/EligibilityBadge packages/ui/src/components/EligibilityBadge
git mv frontend/src/components/EmptyState packages/ui/src/components/EmptyState
git mv frontend/src/components/ErrorMessage packages/ui/src/components/ErrorMessage
git mv frontend/src/components/FileUpload packages/ui/src/components/FileUpload
git mv frontend/src/components/FilterControl packages/ui/src/components/FilterControl
git mv frontend/src/components/FormCard packages/ui/src/components/FormCard
git mv frontend/src/components/LoadingSpinner packages/ui/src/components/LoadingSpinner
git mv frontend/src/components/Modal packages/ui/src/components/Modal
git mv frontend/src/components/NavBar packages/ui/src/components/NavBar
git mv frontend/src/components/PredictedGradeBadge packages/ui/src/components/PredictedGradeBadge
git mv frontend/src/components/QueryBoundary packages/ui/src/components/QueryBoundary
git mv frontend/src/components/SearchFilterBar packages/ui/src/components/SearchFilterBar
git mv frontend/src/components/StarRating packages/ui/src/components/StarRating
git mv frontend/src/components/StatusChip packages/ui/src/components/StatusChip
git mv frontend/src/components/Tabs packages/ui/src/components/Tabs
git mv frontend/src/components/TemplateSelector packages/ui/src/components/TemplateSelector
git mv frontend/src/components/TextInput packages/ui/src/components/TextInput
git mv frontend/src/components/Toast packages/ui/src/components/Toast
```

- [ ] **Step 3: Move lib, context, hooks, and API base**

```bash
cd /Users/bsg/Downloads/schoolchoice
mkdir -p packages/ui/src/lib packages/ui/src/context packages/ui/src/hooks packages/ui/src/api
git mv frontend/src/lib/utils.js packages/ui/src/lib/utils.js
git mv frontend/src/context/AuthContext.jsx packages/ui/src/context/AuthContext.jsx
git mv frontend/src/hooks/useAuth.js packages/ui/src/hooks/useAuth.js
git mv frontend/src/hooks/useToast.js packages/ui/src/hooks/useToast.js
git mv frontend/src/api/client.js packages/ui/src/api/client.js
git mv frontend/src/api/account.js packages/ui/src/api/account.js
git mv frontend/src/api/auth.js packages/ui/src/api/auth.js
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move shared components to packages/ui/

git mv all shared UI components, shadcn primitives, auth context,
API client base, and utility functions. Import paths not yet updated."
```

---

### Task 4: Move app files to apps/web/

**Files:**
- Move: all domain components, pages, domain API modules, domain hooks, build config, static assets

- [ ] **Step 1: Move domain components**

```bash
cd /Users/bsg/Downloads/schoolchoice
mkdir -p apps/web/src/components
git mv frontend/src/components/NavBarV2 apps/web/src/components/NavBarV2
git mv frontend/src/components/ActionPlanDisplay apps/web/src/components/ActionPlanDisplay
git mv frontend/src/components/EntityForm apps/web/src/components/EntityForm
git mv frontend/src/components/EntityListView apps/web/src/components/EntityListView
git mv frontend/src/components/ImportWizard apps/web/src/components/ImportWizard
git mv frontend/src/components/PlanSectionEditor apps/web/src/components/PlanSectionEditor
git mv frontend/src/components/RecommendationCard apps/web/src/components/RecommendationCard
git mv frontend/src/components/SchoolCard apps/web/src/components/SchoolCard
git mv frontend/src/components/ShapSummary apps/web/src/components/ShapSummary
git mv frontend/src/components/SSEStreamDisplay apps/web/src/components/SSEStreamDisplay
git mv frontend/src/components/StudentForm apps/web/src/components/StudentForm
git mv frontend/src/components/StudentRow apps/web/src/components/StudentRow
git mv frontend/src/components/ValidationSummary apps/web/src/components/ValidationSummary
```

- [ ] **Step 2: Move pages, app entry, and domain code**

```bash
cd /Users/bsg/Downloads/schoolchoice
git mv frontend/src/pages apps/web/src/pages
git mv frontend/src/App.jsx apps/web/src/App.jsx
git mv frontend/src/main.jsx apps/web/src/main.jsx
git mv frontend/src/index.css apps/web/src/index.css
git mv frontend/src/utils apps/web/src/utils
git mv frontend/src/assets apps/web/src/assets
git mv frontend/src/test apps/web/src/test
```

- [ ] **Step 3: Move domain API modules**

```bash
cd /Users/bsg/Downloads/schoolchoice
mkdir -p apps/web/src/api
git mv frontend/src/api/students.js apps/web/src/api/students.js
git mv frontend/src/api/cohorts.js apps/web/src/api/cohorts.js
git mv frontend/src/api/schools.js apps/web/src/api/schools.js
git mv frontend/src/api/schoolsV2.js apps/web/src/api/schoolsV2.js
git mv frontend/src/api/targets.js apps/web/src/api/targets.js
git mv frontend/src/api/plan.js apps/web/src/api/plan.js
git mv frontend/src/api/match.js apps/web/src/api/match.js
git mv frontend/src/api/grades.js apps/web/src/api/grades.js
git mv frontend/src/api/analytics.js apps/web/src/api/analytics.js
git mv frontend/src/api/transcripts.js apps/web/src/api/transcripts.js
git mv frontend/src/api/recommendations.js apps/web/src/api/recommendations.js
git mv frontend/src/api/consultant.js apps/web/src/api/consultant.js
git mv frontend/src/api/entities.js apps/web/src/api/entities.js
git mv frontend/src/api/admin.js apps/web/src/api/admin.js
git mv frontend/src/api/methodology.js apps/web/src/api/methodology.js
git mv frontend/src/api/actionPlan.js apps/web/src/api/actionPlan.js
```

- [ ] **Step 4: Move domain hooks**

```bash
cd /Users/bsg/Downloads/schoolchoice
mkdir -p apps/web/src/hooks
git mv frontend/src/hooks/useGradesTab.js apps/web/src/hooks/useGradesTab.js
git mv frontend/src/hooks/useActivitiesTab.js apps/web/src/hooks/useActivitiesTab.js
git mv frontend/src/hooks/usePersonalTab.js apps/web/src/hooks/usePersonalTab.js
git mv frontend/src/hooks/useLanguageTab.js apps/web/src/hooks/useLanguageTab.js
git mv frontend/src/hooks/useEvaluationsTab.js apps/web/src/hooks/useEvaluationsTab.js
git mv frontend/src/hooks/useNotesTab.js apps/web/src/hooks/useNotesTab.js
git mv frontend/src/hooks/usePlansTab.js apps/web/src/hooks/usePlansTab.js
```

- [ ] **Step 5: Move build config and static files**

```bash
cd /Users/bsg/Downloads/schoolchoice
git mv frontend/index.html apps/web/index.html
git mv frontend/vite.config.js apps/web/vite.config.js
git mv frontend/tailwind.config.js apps/web/tailwind.config.js
git mv frontend/postcss.config.cjs apps/web/postcss.config.cjs
git mv frontend/eslint.config.js apps/web/eslint.config.js
git mv frontend/public apps/web/public
git mv frontend/tests apps/web/tests
git mv frontend/.env apps/web/.env
git mv frontend/.env.example apps/web/.env.example
git mv frontend/.gitignore apps/web/.gitignore
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move app files to apps/web/

git mv all domain components, pages, hooks, API modules, build
config, and static assets. Import paths not yet updated."
```

---

### Task 5: Create apps/web/package.json and update build config

**Files:**
- Create: `apps/web/package.json`
- Modify: `apps/web/vite.config.js`
- Modify: `apps/web/tailwind.config.js`
- Create: `apps/web/components.json`
- Modify: `vercel.json`

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@schoolchoice/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@schoolchoice/ui": "workspace:*",
    "@tanstack/react-query": "^5.100.2",
    "@tiptap/pm": "^3.21.0",
    "@tiptap/react": "^3.21.0",
    "@tiptap/starter-kit": "^3.21.0",
    "axios": "^1.13.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.11.0",
    "next-themes": "^0.4.6",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.2",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@playwright/test": "^1.59.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "autoprefixer": "^10.5.0",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "jsdom": "^29.0.2",
    "postcss": "^8.5.10",
    "tailwindcss": "^3.4.19",
    "vite": "^8.0.1",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 2: Update apps/web/vite.config.js**

Replace the file with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    passWithNoTests: true,
  },
})
```

No changes needed — the `@` alias still points to `apps/web/src/`, and pnpm workspace resolution handles `@schoolchoice/ui` imports automatically.

- [ ] **Step 3: Update apps/web/tailwind.config.js**

Replace the content paths to include the UI package:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../../packages/ui/src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--shadcn-accent))', foreground: 'hsl(var(--shadcn-accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--shadcn-border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Create apps/web/components.json**

Update shadcn config paths for the new structure:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@schoolchoice/ui/lib/utils",
    "ui": "@schoolchoice/ui/primitives",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

- [ ] **Step 5: Update vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm install -g pnpm && pnpm install",
  "buildCommand": "pnpm build",
  "outputDirectory": "apps/web/dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/vite.config.js apps/web/tailwind.config.js apps/web/components.json vercel.json
git commit -m "chore: configure apps/web package and build tooling

@schoolchoice/web depends on @schoolchoice/ui via workspace:*.
Tailwind content paths include UI package. Vercel config updated
for monorepo build."
```

---

### Task 6: Update import paths in packages/ui/

**Files:**
- Modify: all files in `packages/ui/src/` that have broken relative imports

The files in `packages/ui/src/` previously imported from relative paths like `../../lib/utils`, `../ui/button`, `../../hooks/useAuth`, and `../../api/account`. These internal paths need to be updated to reflect the new directory structure within `packages/ui/src/`.

- [ ] **Step 1: Find all broken imports in packages/ui/**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '\.\." packages/ui/src/ --include="*.js" --include="*.jsx"`

This lists every relative import that may need updating. The patterns to fix are:

| Old pattern (in component files) | New pattern |
|---|---|
| `from '../../lib/utils'` | `from '../../lib/utils'` (same — still within packages/ui/src/) |
| `from '../ui/button'` | `from '../../primitives/button'` (ui/ renamed to primitives/) |
| `from '../../hooks/useAuth'` | `from '../../hooks/useAuth'` (same — still within packages/ui/src/) |
| `from '../../api/client'` | `from '../../api/client'` (same — still within packages/ui/src/) |
| `from '../../context/AuthContext'` | `from '../../context/AuthContext'` (same) |
| `from '@/components/ui/button'` | `from '../../primitives/button'` (alias-based imports to primitives) |
| `from '@/lib/utils'` | `from '../../lib/utils'` (alias no longer applies in packages/ui/) |

- [ ] **Step 2: Fix shadcn primitive imports**

The shadcn primitives (now in `packages/ui/src/primitives/`) import `cn` from `@/lib/utils`. Since the `@` alias only applies in `apps/web/`, these need to use relative paths.

For each file in `packages/ui/src/primitives/`, replace:
```js
// Before:
import { cn } from "@/lib/utils"
// After:
import { cn } from "../lib/utils"
```

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "@/lib/utils" packages/ui/src/primitives/`

Update every match.

- [ ] **Step 3: Fix shared component imports to primitives**

Shared components that imported from `@/components/ui/button` (or similar) need to import from the new primitives path.

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "@/components/ui/" packages/ui/src/components/`

For each match, update the import. The relative path depends on the component's depth, but since all shared components are at `packages/ui/src/components/ComponentName/ComponentName.jsx`, the pattern is:

```js
// Before:
import { Button } from '@/components/ui/button'
// After:
import { Button } from '../../primitives/button'
```

- [ ] **Step 4: Fix shared component imports to hooks/context/api**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '\.\./" packages/ui/src/components/ --include="*.jsx" --include="*.js"`

Update any relative imports that pointed to the old `frontend/src/` structure. Within `packages/ui/src/components/ComponentName/`, the correct relative paths are:
- `../../hooks/useAuth` for hooks
- `../../api/client` for API client
- `../../context/AuthContext` for context
- `../../lib/utils` for utilities

- [ ] **Step 5: Fix AuthContext import of account API**

`packages/ui/src/context/AuthContext.jsx` imports from `../api/account`. This path is correct in the new structure (context/ and api/ are siblings under src/).

Verify: `cd /Users/bsg/Downloads/schoolchoice && grep -n "from " packages/ui/src/context/AuthContext.jsx`

- [ ] **Step 6: Fix useAuth import of AuthContext**

`packages/ui/src/hooks/useAuth.js` imports from `../context/AuthContext`. This path is correct (hooks/ and context/ are siblings under src/).

Verify: `cd /Users/bsg/Downloads/schoolchoice && grep -n "from " packages/ui/src/hooks/useAuth.js`

- [ ] **Step 7: Verify no broken imports remain**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "@/components/ui\|@/lib/utils\|@/hooks\|@/context" packages/ui/src/`

Expected: no matches (all `@` alias imports replaced with relative paths).

- [ ] **Step 8: Commit**

```bash
git add packages/ui/
git commit -m "fix: update internal import paths in @schoolchoice/ui

Replace @/ alias imports with relative paths. Rename ui/ references
to primitives/. All imports now resolve within packages/ui/src/."
```

---

### Task 7: Update import paths in apps/web/

**Files:**
- Modify: all files in `apps/web/src/` that import shared components

This is the largest task. Every file in `apps/web/src/` that imported from the old `frontend/src/components/`, `frontend/src/hooks/`, `frontend/src/context/`, `frontend/src/api/client`, or `frontend/src/lib/` paths needs to be updated.

- [ ] **Step 1: Update shadcn primitive imports in pages**

Pages previously imported shadcn components via `@/components/ui/button`. These now come from `@schoolchoice/ui`:

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "@/components/ui/" apps/web/src/`

For each match, replace:

```js
// Before:
import { Button } from '@/components/ui/button'
// After:
import { Button } from '@schoolchoice/ui/primitives/button'
```

```js
// Before:
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
// After:
import { Card, CardHeader, CardTitle, CardContent } from '@schoolchoice/ui/primitives/card'
```

Apply this pattern for every shadcn primitive import: `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `popover`, `progress`, `select`, `separator`, `sonner`, `table`, `tabs`.

- [ ] **Step 2: Update shared component imports in pages**

Pages that imported shared components via relative paths like `../../components/Button/Button` need to import from `@schoolchoice/ui`:

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '.*components/\(ActionBar\|Button\|ColumnMapper\|ConfidenceBadge\|EligibilityBadge\|EmptyState\|ErrorMessage\|FileUpload\|FilterControl\|FormCard\|LoadingSpinner\|Modal\|NavBar/\|PredictedGradeBadge\|QueryBoundary\|SearchFilterBar\|StarRating\|StatusChip\|Tabs/\|TemplateSelector\|TextInput\|Toast\)" apps/web/src/`

For each match, replace with the `@schoolchoice/ui` import. The barrel export (`packages/ui/src/index.js`) will export these, so:

```js
// Before:
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner'
// After:
import { LoadingSpinner } from '@schoolchoice/ui'
```

**Note:** Some components may be default exports. If so, the barrel export re-exports them as named exports. The actual import style depends on how each component is exported — check each one.

- [ ] **Step 3: Update useAuth imports**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '.*hooks/useAuth'" apps/web/src/`

Replace:

```js
// Before:
import { useAuth } from '../../hooks/useAuth'
// or:
import { useAuth } from './hooks/useAuth'
// After:
import { useAuth } from '@schoolchoice/ui/hooks/useAuth'
```

- [ ] **Step 4: Update useToast imports**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '.*hooks/useToast'" apps/web/src/`

Replace:

```js
// Before:
import { useToast } from '../../hooks/useToast'
// After:
import { useToast } from '@schoolchoice/ui/hooks/useToast'
```

- [ ] **Step 5: Update AuthContext imports**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '.*context/AuthContext'" apps/web/src/`

Replace:

```js
// Before:
import { AuthProvider } from './context/AuthContext'
// After:
import { AuthProvider } from '@schoolchoice/ui/context/AuthContext'
```

- [ ] **Step 6: Update API client imports in domain API modules**

The domain API modules in `apps/web/src/api/` import from `./client` which was moved to `packages/ui/src/api/client.js`. Update them:

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from './client'" apps/web/src/api/`

Replace:

```js
// Before:
import client from './client'
// After:
import client from '@schoolchoice/ui/api/client'
```

- [ ] **Step 7: Update domain hooks that import API client**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '.*api/client'" apps/web/src/hooks/`

Replace:

```js
// Before:
import client from '../api/client'
// After:
import client from '@schoolchoice/ui/api/client'
```

- [ ] **Step 8: Update domain components that import shared components**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "from '\.\./" apps/web/src/components/ --include="*.jsx" --include="*.js"`

For each import that references a component now in `@schoolchoice/ui`, update to use the package import. For imports referencing other domain components (still in `apps/web/src/components/`), update the relative path if needed.

- [ ] **Step 9: Update @/lib/utils imports**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "@/lib/utils" apps/web/src/`

Replace:

```js
// Before:
import { cn } from '@/lib/utils'
// After:
import { cn } from '@schoolchoice/ui/lib/utils'
```

- [ ] **Step 10: Update main.jsx Toaster import**

In `apps/web/src/main.jsx`:

```js
// Before:
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from './context/AuthContext'
// After:
import { Toaster } from '@schoolchoice/ui/primitives/sonner'
import { AuthProvider } from '@schoolchoice/ui/context/AuthContext'
```

- [ ] **Step 11: Verify no broken @/ imports remain for moved files**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "@/components/ui/\|@/lib/utils\|@/hooks/useAuth\|@/hooks/useToast\|@/context/" apps/web/src/`

Expected: no matches.

- [ ] **Step 12: Commit**

```bash
git add apps/web/
git commit -m "fix: update all import paths in apps/web/

Shared components now imported from @schoolchoice/ui. Domain API
modules import client from @schoolchoice/ui/api/client. All
shadcn primitives imported from @schoolchoice/ui/primitives/."
```

---

### Task 8: Write the barrel export for @schoolchoice/ui

**Files:**
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Inventory all exports**

Run: `cd /Users/bsg/Downloads/schoolchoice && grep -rn "^export " packages/ui/src/components/ packages/ui/src/context/ packages/ui/src/hooks/ packages/ui/src/lib/ packages/ui/src/api/`

This shows every exported symbol. Use this to build the barrel.

- [ ] **Step 2: Write the barrel export**

Replace `packages/ui/src/index.js` with re-exports of all shared components. The exact exports depend on how each component is exported (default vs named). The general pattern:

```js
// @schoolchoice/ui — barrel export

// Context
export { AuthContext, AuthProvider } from './context/AuthContext'

// Hooks
export { useAuth } from './hooks/useAuth'
export { useToast } from './hooks/useToast'

// API
export { default as apiClient } from './api/client'
export { getAccount, updateAccount, changePassword, deleteAccount } from './api/account'
export { login, register } from './api/auth'

// Lib
export { cn } from './lib/utils'

// Components — re-export each shared component
// Check each component's export style (default vs named) from the grep output in Step 1.
// Default exports use: export { default as ComponentName } from './components/ComponentName/ComponentName'
// Named exports use: export { ComponentName } from './components/ComponentName/ComponentName'
//
// Expected components (verify export style from grep):
// ActionBar, Button, ColumnMapper, ConfidenceBadge, EligibilityBadge,
// EmptyState, ErrorMessage, FileUpload, FilterControl, FormCard,
// LoadingSpinner, Modal, NavBar, PredictedGradeBadge, QueryBoundary,
// SearchFilterBar, StarRating, StatusChip, Tabs, TemplateSelector,
// TextInput, Toast
```

Fill in the actual component exports based on the grep results. Every shared component must appear here.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/index.js
git commit -m "feat: populate @schoolchoice/ui barrel export

Re-exports all shared components, primitives, hooks, context,
API client, and utilities from a single entry point."
```

---

### Task 9: Clean up old frontend/ directory and install dependencies

**Files:**
- Delete: `frontend/` (everything remaining)
- Modify: `.gitignore` (update frontend/ references)
- Run: `pnpm install`

- [ ] **Step 1: Check what remains in frontend/**

Run: `cd /Users/bsg/Downloads/schoolchoice && find frontend/ -type f 2>/dev/null | head -30`

After all `git mv` operations, there should be very little left. Remaining items may include:
- `frontend/node_modules/` (gitignored)
- `frontend/dist/` (gitignored)
- `frontend/package.json` (no longer needed)
- `frontend/package-lock.json` (no longer needed)
- `frontend/Dockerfile` (move or delete based on deployment needs)
- `frontend/README.md`, `frontend/FRONTEND_MANIFEST.md`, etc. (docs)

- [ ] **Step 2: Remove frontend/package.json and package-lock.json**

```bash
cd /Users/bsg/Downloads/schoolchoice
git rm frontend/package.json frontend/package-lock.json
```

- [ ] **Step 3: Move or remove remaining frontend/ files**

Move documentation to apps/web/ if still relevant:

```bash
git mv frontend/README.md apps/web/README.md
git mv frontend/FRONTEND_MANIFEST.md apps/web/FRONTEND_MANIFEST.md
git mv frontend/FRONTEND_MANIFEST_V2.md apps/web/FRONTEND_MANIFEST_V2.md
git mv frontend/TEST_RESULTS.md apps/web/TEST_RESULTS.md
git mv frontend/TEST_RESULTS_V2.md apps/web/TEST_RESULTS_V2.md
```

Remove Dockerfile (deployment config will need separate update):

```bash
git rm frontend/Dockerfile
```

Remove nginx.conf (Vercel deployment, not nginx):

```bash
git rm frontend/nginx.conf
```

- [ ] **Step 4: Update .gitignore**

Replace `frontend/dist/` and `frontend/.env.local` references:

```
# Before:
frontend/dist/
frontend/.env.local

# After:
apps/web/dist/
apps/web/.env.local
```

- [ ] **Step 5: Delete frontend/node_modules and any remaining untracked files**

```bash
cd /Users/bsg/Downloads/schoolchoice
rm -rf frontend/node_modules frontend/dist frontend/test-results
rmdir frontend/src/components frontend/src/api frontend/src/hooks frontend/src/lib frontend/src/context frontend/src 2>/dev/null
rmdir frontend 2>/dev/null
```

If `rmdir` fails because files remain, check what's left with `ls -la frontend/` and handle accordingly.

- [ ] **Step 6: Remove old root node_modules and package-lock.json**

```bash
cd /Users/bsg/Downloads/schoolchoice
rm -rf node_modules package-lock.json
```

- [ ] **Step 7: Install dependencies with pnpm**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm install`

Expected: successful install with workspace packages linked. Output should show `@schoolchoice/web` depends on `@schoolchoice/ui` via workspace link.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove old frontend/ directory, install pnpm deps

Cleaned up old frontend structure. All code now lives in apps/web/
and packages/ui/. Dependencies managed by pnpm workspaces."
```

---

### Task 10: Verify the app works

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm dev`

Expected: Vite dev server starts on the usual port (5173) without errors.

- [ ] **Step 2: Check for build errors**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm build`

Expected: build completes successfully, output in `apps/web/dist/`.

- [ ] **Step 3: Check for import resolution errors**

If the dev server or build fails with import errors, the error message will point to the exact file and import path. Fix each one:

1. Read the error to identify the file and the import that can't be resolved
2. Check if the target file exists at the expected path
3. Update the import to the correct path
4. Re-run `pnpm dev` or `pnpm build`

Common issues:
- A component in `apps/web/` still uses a relative path to a file that moved to `packages/ui/`
- A file in `packages/ui/` uses the `@` alias which only works in `apps/web/`
- A domain component imports another domain component with an incorrect relative path

- [ ] **Step 4: Navigate to the login page**

Open `http://localhost:5173/login` in a browser. Verify:
- Page loads without blank screen
- No console errors
- Login form renders correctly

- [ ] **Step 5: Log in and verify dashboard**

Log in with test credentials (verify@test.com / verify123). Verify:
- Dashboard loads
- NavBar renders with organisation name
- No console errors

- [ ] **Step 6: Spot-check a student profile**

Navigate to a student profile. Verify:
- Profile page loads with tabs
- Grade data displays
- No console errors

- [ ] **Step 7: Run existing tests**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web vitest run 2>/dev/null; cd backend && python -m pytest --tb=short -q`

Expected: all tests pass. Frontend tests may need path updates if they import from moved locations.

- [ ] **Step 8: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve import path issues found during verification

Post-move fixes for broken imports discovered during dev server
and build testing."
```

---

## Summary

| Task | What it does | Dependencies |
|------|-------------|--------------|
| 1 | Initialize pnpm workspace config | None |
| 2 | Scaffold @schoolchoice/ui package | Task 1 |
| 3 | Move shared files to packages/ui/ | Task 2 |
| 4 | Move app files to apps/web/ | Task 2 |
| 5 | Create apps/web/package.json, update build config | Tasks 3, 4 |
| 6 | Update import paths in packages/ui/ | Task 3 |
| 7 | Update import paths in apps/web/ | Tasks 4, 6 |
| 8 | Write barrel export for @schoolchoice/ui | Task 6 |
| 9 | Clean up old frontend/, install pnpm deps | Tasks 7, 8 |
| 10 | Verify the app works end-to-end | Task 9 |

Tasks 1-2 are sequential. Tasks 3-4 can be parallelised. Tasks 5-8 are sequential. Tasks 9-10 are sequential.
