# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Client-Server with Service-Oriented Backend

A two-tier full-stack architecture where React manages the UI and state, FastAPI handles business logic, and PostgreSQL persists data. The backend implements a service layer for domain logic (matching, plan generation, authentication) and uses SQLAlchemy ORM for data access.

**Key Characteristics:**
- RESTful JSON API communication between frontend and backend
- Token-based JWT authentication (locally managed, no external auth provider)
- Background task support for long-running operations (plan generation)
- Multi-version API routes (v1: legacy, v2: current)
- Domain-specific service modules (matching, plan generation, HKDSE grading)
- JSONB for semi-structured data (teacher evaluations, SHAP explanations, scores)

## Layers

**Presentation Layer:**
- Purpose: User interaction and state management
- Location: `frontend/src/`
- Contains: React pages, components, context (AuthContext), API clients
- Depends on: API client (`frontend/src/api/client.js`), AuthContext
- Used by: End users (counselors) via browser

**API Gateway / Router Layer:**
- Purpose: HTTP routing, request/response validation
- Location: `backend/app/main.py`, `backend/app/api/v1/routes/`
- Contains: FastAPI routers prefixed with `/api/v1` (auth, students, plans, schools, etc.)
- Depends on: Core (security, config), Services, Database models
- Used by: Frontend via HTTP, third-party integrations

**Service Layer:**
- Purpose: Business logic and domain algorithms
- Location: `backend/app/services/`
- Contains:
  - `plan_generator.py` — HTML plan document generation with template support
  - `matchmaker_v2.py` — Eligibility filtering, weighted scoring, ML scoring
  - `plan_chat_service.py` — Gemini AI integration for plan modification
  - `hkdse_service.py` — HKDSE-specific grading rules and conversions
  - `auth_service.py` — User registration/login logic
  - `student_service.py`, `school_service.py` — CRUD helpers
- Depends on: Database session, models, configuration, external APIs (Gemini)
- Used by: API routers

**Data Access Layer:**
- Purpose: ORM models and database session management
- Location: `backend/app/db/`
- Contains:
  - `models.py` — v1 legacy models (User, Student, School, etc.)
  - `models_v2.py` — v2 models (GradeSystem, Subject, StudentSubjectGrade, AcademicPlan, etc.)
  - `session.py` — SQLAlchemy engine and session factory
- Depends on: Configuration (DATABASE_URL)
- Used by: Service layer via SQLAlchemy Session dependency

**Core Utilities:**
- Purpose: Cross-cutting concerns
- Location: `backend/app/core/`
- Contains:
  - `config.py` — Environment variable loading (DATABASE_URL, SECRET_KEY, CORS_ORIGINS)
  - `security.py` — Password hashing (bcrypt), JWT token creation/verification
  - `dependencies.py` — FastAPI dependency functions (get_current_user, get_db)
- Depends on: Pydantic, cryptography libraries
- Used by: Routers and services

**Request/Response Schemas:**
- Purpose: Input validation and serialization
- Location: `backend/app/schemas/` (v1) and `backend/app/schemas/v2/` (v2)
- Contains: Pydantic models for endpoint requests and responses
- Used by: API routers to validate and document endpoints

## Data Flow

**User Authentication:**

1. Frontend: User submits login form → `POST /api/v1/login` (email + password)
2. Router (auth.py): Route handler validates credentials via `auth_service.authenticate_user()`
3. Service: Queries User by email, verifies bcrypt hash with `verify_password()`
4. Router: On success, generates JWT via `create_access_token()`, returns token
5. Frontend: Stores token in localStorage, sets AuthContext, redirects to /dashboard

**Student Profile Access:**

1. Frontend: GET `/api/v1/students/{id}` with Authorization header
2. Router: `get_current_user()` dependency extracts and verifies JWT
3. Router: Queries Student by ID from database, builds StudentFullResponse
4. Frontend: Renders Dashboard or StudentProfile page with returned data

**Plan Generation (Async Background Task):**

1. Frontend: POST `/api/v1/students/{id}/plan/generate` → triggers background job
2. Router: Creates PlanGenerationJob record (status="QUEUED"), returns job_id to frontend
3. Router: Enqueues background task `_generate_plan_task(job_id, student_id)`
4. Background:
   - Loads student, subjects, schools from database
   - Calls `run_matching()` (eligibility + scoring)
   - Calls `generate_html_plan()` (renders template)
   - Saves AcademicPlan record
   - Marks job DONE
5. Frontend: Polls GET `/api/v1/students/{id}/plan/status/{job_id}` for job.status
6. When DONE, renders plan HTML in modal/page

**School Matching & Recommendation:**

1. Backend: `matchmaker_v2.run_matching()` called during plan generation
2. Step 1: Eligibility Filter
   - Student's best-5 aggregate vs school's minimum_entry_score
   - Required subjects check (student must have all required subjects at min grade)
   - IELTS requirement check (if applicable)
   - Output: eligibility_pass (bool), failing_criteria (list)
3. Step 2: Scoring (if eligible or near-eligible)
   - Weighted multi-criteria: academic fit (50%), subject alignment (20%), language fit (15%), program alignment (15%)
   - If ML model exists: XGBoost classifier produces probability, final = 0.6×weighted + 0.4×ml_prob
   - SHAP values computed for feature importance
4. Step 3: Ranking
   - Sort schools by fit_score descending
   - Boost student's preference-ranked schools
5. Output: StudentSchoolTarget records with match_score, shap_explanation, rationale

**Plan Modification via AI Chat:**

1. Frontend: POST `/api/v1/students/{id}/plan/chat` with user message
2. Router: Rate-limit check (max 20 requests/day per plan)
3. Service (plan_chat_service.py):
   - Loads current AcademicPlan
   - Constructs Gemini prompt with plan data + user message
   - Calls Google Generative AI API
   - Receives JSON patch response (e.g. `{"recommended_schools[0].fit_score": 0.82}`)
4. Service: Applies patch to plan, increments version, regenerates HTML
5. Frontend: Displays updated plan

**State Management:**

- Authentication: AuthContext (React) + JWT in localStorage
- Page State: Local useState hooks (search, filters, loading, errors)
- Server State: No Redux/Zustand; direct API calls via `frontend/src/api/*.js` clients
- Plan Data: Loaded once, re-fetched after chat modifications

## Key Abstractions

**Matchmaker Engine:**
- Purpose: Compute school fit for a student
- Examples: `backend/app/services/matchmaker_v2.py`
- Pattern: Functional data processing (eligibility → scoring → ranking)
- Key functions:
  - `run_eligibility_filter()` — hard constraints
  - `run_weighted_scoring()` — multi-criteria scoring
  - `run_ml_scoring()` — XGBoost classifier (if available)
  - `run_matching()` — orchestrator that chains all steps

**Plan Generator:**
- Purpose: Render academic plan as styled HTML document
- Examples: `backend/app/services/plan_generator.py`
- Pattern: Template-based string building with CSS variables
- Key features:
  - Three templates: professional (Georgia serif), modern (teal, Inter), minimal (dense)
  - Chart.js integration (via CDN) for radar, bar charts
  - Print-safe CSS (@media print)
  - Section overrides for edited content

**HKDSE Grade Service:**
- Purpose: Grade system conversions and rules
- Examples: `backend/app/services/hkdse_service.py`
- Pattern: Lookup tables and conversion functions
- Key operations: `grade_to_int()`, `best_5_aggregate()`, `predicted_grade()`

**API Client Factory:**
- Purpose: Centralized HTTP communication
- Examples: `frontend/src/api/client.js` + domain-specific clients (`students.js`, `plan.js`, etc.)
- Pattern: Axios with interceptors for auth (JWT injection), error handling (401 redirect)

## Entry Points

**Backend:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --host 0.0.0.0 --port 8000` (dev: local startup)
- Responsibilities:
  - Create FastAPI app
  - Register CORS middleware
  - Create database tables (v1 + v2 Base.metadata)
  - Auto-seed subjects and schools if empty
  - Include all API routers under `/api/v1`
  - Start upload directory
  - Health check endpoint: `GET /health`

**Frontend:**
- Location: `frontend/src/main.jsx`
- Triggers: `npm run dev` (Vite dev server)
- Responsibilities:
  - Mount React root
  - Wrap app in StrictMode
  - Provide AuthContext
  - Load global CSS tokens

**Frontend App:**
- Location: `frontend/src/App.jsx`
- Responsibilities:
  - BrowserRouter setup
  - Route definitions (public: /login, /register; protected: rest)
  - ProtectedRoute wrapper (redirects unauthenticated users to /login)
  - v1 routes (legacy): /students, /students/:id, /students/:id/recommendations
  - v2 routes (current): /dashboard, /students/:id/profile, /students/:id/targets, /students/:id/plan, /schools, /schools/:id, /account/settings, /admin/data-refresh, /cohorts, /data-analysis

## Error Handling

**Strategy:** Consistent HTTP status codes, JSON error responses, client-side toast notifications

**Patterns:**

- Backend: FastAPI HTTPException with status_code + detail
  - 400 Bad Request: validation failure
  - 401 Unauthorized: missing/invalid token
  - 404 Not Found: resource not found
  - 500 Internal Server Error: unhandled exception
- Frontend: axios error interceptor catches 401, clears token, redirects to /login
- Frontend: Errors displayed as Toast notifications (temporary, dismissible)
- Async operations: Loading spinner during request, error state shown if request fails

## Cross-Cutting Concerns

**Logging:**
- Backend: Python standard logging (configured in main.py or via env)
- Frontend: Console.log for debugging; production errors sent to ErrorMessage components

**Validation:**
- Backend: Pydantic models in schemas/ validate all inputs at router layer
- Frontend: Minimal validation (required fields, email format); relies on backend validation

**Authentication:**
- Backend: JWT verification via `get_current_user()` dependency on protected routes
- Frontend: Token stored in localStorage, injected into every request via axios interceptor
- Session: 30-minute JWT expiry (configurable via ACCESS_TOKEN_EXPIRE_MINUTES)

**Database Transactions:**
- Backend: SQLAlchemy sessions per request (get_db dependency)
- Transactions: Explicit commit/rollback in services where needed (e.g., seeding, plan generation)
- No global transaction manager; each route handler owns its session lifecycle

---

*Architecture analysis: 2026-04-24*
