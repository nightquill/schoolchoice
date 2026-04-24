# Codebase Structure

**Analysis Date:** 2026-04-24

## Directory Layout

```
schoolchoice/
├── backend/                      # FastAPI application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app initialization, routing, seeding
│   │   ├── api/v1/routes/        # All endpoint handlers
│   │   ├── core/                 # Security, config, dependencies
│   │   ├── db/                   # ORM models, session management
│   │   ├── schemas/              # Request/response Pydantic models
│   │   └── services/             # Business logic (matching, plan generation, etc.)
│   ├── tests/                    # Pytest test suite
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── pytest.ini
│   └── test.db                   # SQLite test database
├── frontend/                     # React application
│   ├── src/
│   │   ├── main.jsx             # React root entry point
│   │   ├── App.jsx              # Route definitions, ProtectedRoute
│   │   ├── api/                 # HTTP client modules (one per domain)
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Page components (one per route)
│   │   ├── context/             # React Context (AuthContext)
│   │   ├── hooks/               # Custom React hooks
│   │   ├── utils/               # Utility functions, token.css
│   │   ├── assets/              # Images, icons
│   │   └── index.css            # Global styles
│   ├── package.json
│   ├── vite.config.js
│   ├── node_modules/
│   └── .env                      # Frontend env vars (VITE_API_BASE_URL)
├── data/                         # Data seed files and sources
│   ├── seed/                     # SQL seed files
│   ├── sources.md               # Data source registry
│   ├── raw/                     # Raw extracted data (JSON)
│   └── processed/               # Cleaned data (JSON)
├── database/                     # Database schema and migrations
├── architecture/                 # Architecture decision records (ADRs)
├── design/                       # UI design specs and Figma links
├── integration/                  # Integration test suite
├── requirements/                 # Product requirements (REQ-*.md)
├── skills/                       # Agent skills documentation
├── .planning/
│   └── codebase/                # GSD codebase analysis (this output)
├── .claude/                      # Claude agent configuration
├── .git/                         # Git repository
└── preferences.md               # Product definition & tech stack
```

## Directory Purposes

**backend/app/:**
- Purpose: FastAPI application root
- Contains: Initialization, routing, core utilities, ORM models, services
- Key files: `main.py`

**backend/app/api/v1/routes/:**
- Purpose: HTTP endpoint handlers
- Contains: One file per domain (auth.py, students.py, plan.py, schools.py, targets.py, etc.)
- Key files:
  - `auth.py` — Login, register
  - `students.py` — Student CRUD, profile updates
  - `plan.py` — Plan generation, status, chat, template editing
  - `schools.py`, `schools_v2.py` — School queries
  - `match.py` — Matching endpoints
  - `targets.py` — Student–school target management
  - `grades.py` — Student grade entry
  - `transcripts.py` — PDF transcript upload/parsing
  - `account.py` — User account settings
  - `admin.py` — Admin-only endpoints
  - `cohorts.py` — Group management
  - `analytics.py` — Data analysis queries

**backend/app/core/:**
- Purpose: Cross-cutting concerns
- Contains: Configuration, security, dependency injection
- Key files:
  - `config.py` — Pydantic BaseSettings for DATABASE_URL, SECRET_KEY, CORS_ORIGINS
  - `security.py` — Password hashing (bcrypt), JWT creation/verification
  - `dependencies.py` — FastAPI dependencies (get_current_user, get_db)

**backend/app/db/:**
- Purpose: Data layer
- Contains: SQLAlchemy ORM models, session factory
- Key files:
  - `models.py` — v1 models (User, Student, School, Recommendation, ActionPlan)
  - `models_v2.py` — v2 models (GradeSystem, Subject, StudentSubjectGrade, StudentSchoolTarget, AcademicPlan, etc.)
  - `session.py` — SQLAlchemy engine, SessionLocal factory, get_db dependency

**backend/app/schemas/:**
- Purpose: Request/response validation
- Contains: Pydantic models (v1) and v2/ subdirectory
- Key files:
  - `user.py`, `student.py`, `school.py`, `action_plan.py` (v1)
  - `v2/` subdirectory with `plan.py`, `plan_chat.py`, `targets.py`, etc.

**backend/app/services/:**
- Purpose: Business logic
- Contains: Domain-specific algorithms and workflows
- Key files:
  - `plan_generator.py` — HTML plan rendering with template support, chart integration
  - `matchmaker_v2.py` — School matching (eligibility, scoring, ranking)
  - `plan_chat_service.py` — Gemini AI integration for plan modifications
  - `hkdse_service.py` — HKDSE grading rules, grade conversions
  - `auth_service.py` — User authentication
  - `student_service.py` — Student CRUD helpers
  - `school_service.py` — School lookups
  - `matching_service.py` — v1 legacy matching

**frontend/src/pages/:**
- Purpose: Page components (one per route)
- Contains: Full-page components
- Key files:
  - `LoginPage/LoginPage.jsx` — v1 login (public)
  - `RegisterPage/RegisterPage.jsx` — v1 registration (public)
  - `Dashboard/Dashboard.jsx` — v2 student list + overview
  - `StudentProfile/StudentProfile.jsx` — Tabbed student editor
  - `StudentDetailPage/StudentDetailPage.jsx` — v1 legacy student detail
  - `TargetSchools/TargetSchools.jsx` — Student–school targets, matching
  - `AcademicPlan/AcademicPlan.jsx` — Plan view + chat sidebar
  - `SchoolDirectory/SchoolDirectory.jsx` — Searchable school list
  - `SchoolProfile/SchoolProfile.jsx` — Individual school detail
  - `AccountSettings/AccountSettings.jsx` — User account page
  - `AdminDataRefresh/AdminDataRefresh.jsx` — Admin data refresh trigger
  - `CohortList/CohortList.jsx`, `CohortDetail/CohortDetail.jsx` — Group management
  - `DataAnalysis/DataAnalysis.jsx`, `SubjectDetail/SubjectDetail.jsx` — Analytics

**frontend/src/components/:**
- Purpose: Reusable UI components
- Contains: One subdirectory per component
- Key files:
  - `NavBar/NavBar.jsx` — v1 navigation
  - `NavBarV2/NavBarV2.jsx` — v2 navigation (improved)
  - `Button/Button.jsx` — Styled button
  - `FormCard/FormCard.jsx` — Form wrapper
  - `Modal/Modal.jsx` — Modal dialog
  - `LoadingSpinner/LoadingSpinner.jsx` — Async loading indicator
  - `ErrorMessage/ErrorMessage.jsx` — Error display
  - `EmptyState/EmptyState.jsx` — Empty list message
  - `FileUpload/FileUpload.jsx` — File picker + upload
  - `Toast/Toast.jsx` — Temporary notification
  - `Tabs/Tabs.jsx` — Tab widget
  - `ActionPlanDisplay/ActionPlanDisplay.jsx` — Timeline display
  - `RecommendationCard/RecommendationCard.jsx` — School card
  - `SchoolCard/SchoolCard.jsx` — School info card
  - `ShapSummary/ShapSummary.jsx` — Feature importance summary
  - `PredictedGradeBadge/PredictedGradeBadge.jsx` — Grade prediction indicator
  - `EligibilityBadge/EligibilityBadge.jsx` — Pass/fail indicator
  - `StatusChip/StatusChip.jsx` — Status badge
  - `StarRating/StarRating.jsx` — Rating widget
  - `PlanSectionEditor/PlanSectionEditor.jsx` — Rich text editor (TipTap integration)

**frontend/src/api/:**
- Purpose: HTTP client modules
- Contains: One file per domain, plus shared client
- Key files:
  - `client.js` — Axios instance with auth interceptor, CORS handling
  - `auth.js` — Login, register endpoints
  - `students.js` — Student CRUD
  - `plan.js` — Plan generation, status, chat, template edit
  - `schools.js`, `schoolsV2.js` — School queries
  - `match.js` — Matching
  - `targets.js` — Target school management
  - `grades.js` — Grade entry
  - `transcripts.js` — Transcript upload
  - `account.js` — Account settings
  - `cohorts.js` — Group management
  - `analytics.js` — Analytics queries

**frontend/src/context/:**
- Purpose: React Context (global state)
- Contains: Context providers
- Key files:
  - `AuthContext.jsx` — Token + isAuthenticated + login/logout methods

**frontend/src/hooks/:**
- Purpose: Custom React hooks
- Key files:
  - `useAuth.js` — Consume AuthContext
  - `useToast.js` — Toast notification trigger

**frontend/src/utils/:**
- Purpose: Utility functions
- Key files:
  - `tokens.css` — Design tokens (colors, spacing, fonts)

**data/seed/:**
- Purpose: Database seed files
- Contains: SQL INSERT statements
- Key files:
  - `seed_subjects.sql` — HKDSE + A-Level subjects
  - `seed_schools.sql` — University and polytechnic profiles
- Seeded automatically by `main.py` if tables are empty

**data/sources.md:**
- Purpose: Data source registry
- Contains: URL, date, freshness, confidence level for each source
- Updated by Data Agent

**database/:**
- Purpose: Schema documentation and migrations
- Contains: Schema specs, migration scripts (if any)

**architecture/:**
- Purpose: Architecture decision records
- Contains: ADRs explaining major technical choices

**design/:**
- Purpose: UI/UX specifications
- Contains: Figma links, mockups, design tokens

**integration/:**
- Purpose: Integration test suite
- Contains: End-to-end and integration tests

**requirements/:**
- Purpose: Product requirements
- Contains: REQ-*.md files referencing specific product features

**skills/:**
- Purpose: Agent skills documentation
- Contains: Reusable patterns and lessons learned by agents

## Key File Locations

**Entry Points:**

- Backend: `backend/app/main.py`
- Frontend: `frontend/src/main.jsx`
- Frontend routing: `frontend/src/App.jsx`

**Configuration:**

- Backend config: `backend/app/core/config.py` (reads DATABASE_URL, SECRET_KEY, CORS_ORIGINS from .env)
- Frontend config: `frontend/.env` (VITE_API_BASE_URL)
- Vite config: `frontend/vite.config.js`

**Core Logic:**

- Plan generation: `backend/app/services/plan_generator.py`
- School matching: `backend/app/services/matchmaker_v2.py`
- AI plan chat: `backend/app/services/plan_chat_service.py`
- HKDSE rules: `backend/app/services/hkdse_service.py`

**Testing:**

- Backend tests: `backend/tests/` (pytest)
- Frontend tests: None yet configured (Jest/Vitest setup planned)

**Database Schema:**

- v1 models: `backend/app/db/models.py`
- v2 models: `backend/app/db/models_v2.py` (extends v1 via shared Base)

## Naming Conventions

**Files:**

- React components: PascalCase + .jsx (e.g. `StudentProfile.jsx`)
- Python modules: snake_case + .py (e.g. `plan_generator.py`)
- API clients: camelCase + .js (e.g. `students.js`, `schoolsV2.js`)
- Test files: `test_*.py` (pytest convention)
- Styles: `.css` files alongside component (co-located)

**Directories:**

- Component directories: PascalCase (e.g. `components/StudentProfile/`)
- Service directories: Flat under `services/`
- Page directories: PascalCase (e.g. `pages/Dashboard/`)
- API routes: snake_case prefix in routers (e.g. `api/v1/routes/students.py`)

**Functions & Variables:**

- Backend: snake_case for functions, camelCase for Pydantic fields
- Frontend: camelCase for functions and variables, PascalCase for components
- Constants: UPPER_SNAKE_CASE

**CSS Classes:**

- BEM-inspired: `.component__child--modifier` (e.g. `.student-card__header--active`)
- Token-based: Custom properties via `utils/tokens.css` (e.g. `--color-primary`)

## Where to Add New Code

**New Feature (e.g. Scholarship Database):**

1. **Backend:**
   - Model: Add table to `backend/app/db/models_v2.py` (or `models.py` if simple)
   - Route: Create `backend/app/api/v1/routes/scholarships.py`
   - Service: If complex logic, create `backend/app/services/scholarship_service.py`
   - Schema: Add Pydantic models to `backend/app/schemas/v2/scholarships.py`

2. **Frontend:**
   - Page: Create `frontend/src/pages/ScholarshipDirectory/ScholarshipDirectory.jsx`
   - API: Create `frontend/src/api/scholarships.js`
   - Components: Add shared components to `frontend/src/components/` as needed

**New Component (e.g. GradeInput):**

- Location: `frontend/src/components/GradeInput/`
- Files:
  - `GradeInput.jsx` — Component
  - `GradeInput.css` — Styles
  - `GradeInput.test.jsx` — Unit tests (when added)

**New Utility Function (e.g. formatGPA):**

- Location: `frontend/src/utils/formatters.js` or `backend/app/services/utils.py`
- Pattern: Export named functions, document with docstrings/JSDoc

**New Endpoint:**

1. Create route handler in appropriate file under `backend/app/api/v1/routes/`
2. Define request/response schemas in `backend/app/schemas/v2/`
3. Call service methods or database queries (via `db` dependency)
4. Return Pydantic model (auto-serialized to JSON by FastAPI)

**New Service (Business Logic):**

- Location: `backend/app/services/<domain>.py`
- Pattern: Functional or class-based, takes database session as argument, returns data dict or Pydantic model

## Special Directories

**backend/.pytest_cache/:**
- Purpose: Pytest cache (internal)
- Generated: Yes
- Committed: No (in .gitignore)

**backend/.ruff_cache/:**
- Purpose: Ruff linter cache (internal)
- Generated: Yes
- Committed: No (in .gitignore)

**backend/test.db:**
- Purpose: SQLite test database for integration tests
- Generated: Yes
- Committed: No (in .gitignore)

**frontend/node_modules/:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No (in .gitignore)

**data/cache/:**
- Purpose: Fetched data cache (Data Agent uses this to avoid re-fetching)
- Generated: Yes
- Committed: No (in .gitignore)

**.planning/:**
- Purpose: GSD orchestrator output (codebase maps, phase plans, execution logs)
- Generated: Yes
- Committed: Yes (tracks analysis history)

---

*Structure analysis: 2026-04-24*
