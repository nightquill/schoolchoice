# External Integrations

**Analysis Date:** 2026-04-24

## APIs & External Services

**AI Chat & Plan Editing:**
- Google Generative AI (Gemini 2.5 Flash)
  - What it's used for: Natural language processing for counsellor plan edits (change rationale, adjust scores, reorder schools, modify action items)
  - SDK/Client: `google.generativeai` Python SDK (not in requirements.txt; installed separately)
  - Auth: `GEMINI_API_KEY` environment variable
  - Integration point: `app/services/plan_chat_service.py` - POST `/api/v1/students/{id}/plan/chat`
  - Rate limiting: 20 requests per counsellor per plan per calendar day
  - Response: JSON patch object specifying exact plan modifications, regenerates HTML document
  - Fallback: Returns HTTP 503 if GEMINI_API_KEY not configured; AI chat feature gracefully unavailable

## Data Storage

**Databases:**
- PostgreSQL 15+
  - Connection: `DATABASE_URL` environment variable (required, format: `postgresql+psycopg2://user:password@host:port/dbname`)
  - Client: SQLAlchemy 2.0.30 (ORM)
  - Schema: Via SQLAlchemy Base.metadata + Alembic migrations
  - Key tables: Student, GradeSystem, Subject, StudentSubjectGrade, Transcript, School, StudentSchoolTarget, AcademicPlan
  - JSON storage: JSONB columns for teacher_evaluation, language_scores, extra_curricular, awards, shap_explanation, recommended_schools, action_items, overrides, chat_request_counts

**File Storage:**
- Local filesystem only (development and production)
  - Transcript PDFs/images: `transcript_file_path` stored as relative path in database
  - No cloud storage integration (S3, GCS, Azure Blob, etc.)
  - File handling via `app/services/transcripts.py` endpoint

**Caching:**
- None - no Redis or memcached configured
- Session state stored in database (no in-memory cache layer)

## Authentication & Identity

**Auth Provider:**
- Custom, in-house implementation
  - JWT-based with HS256 algorithm
  - Implementation: `app/core/security.py` for token generation/validation
  - Routes: `app/api/v1/routes/auth.py` (login, register, refresh token)
  - Password hashing: bcrypt via passlib[bcrypt]
  - Token expiry: 30 minutes (production) or 60 minutes (development) configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`
  - Signing key: `SECRET_KEY` environment variable (minimum 32 bytes, generated via `openssl rand -hex 32`)

## Monitoring & Observability

**Error Tracking:**
- None detected - no Sentry, DataDog, New Relic, or similar
- Application relies on log output and HTTP status codes

**Logs:**
- Standard output via uvicorn and FastAPI default logging
- No external log aggregation (ELK, Splunk, CloudWatch, etc.)
- Debug mode controlled via FastAPI configuration

## CI/CD & Deployment

**Hosting:**
- Self-hosted (local development setup)
- Production deployment model: Not specified in codebase
  - Expects PostgreSQL database to be running
  - Expects environment variables to be set

**CI Pipeline:**
- None detected in repository
- Local test execution via `pytest` command
- No GitHub Actions, GitLab CI, or similar workflow files

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (must be present, no default)
- `SECRET_KEY` - JWT signing secret, minimum 32 bytes (must be present, no default)
- `ALGORITHM` - JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiry in minutes (default: 30)
- `CORS_ORIGINS` - Comma-separated allowed origins (default: `http://localhost:5173,http://localhost:3000`)

**Optional env vars:**
- `GEMINI_API_KEY` - Google Generative AI API key for plan chat feature (if omitted, chat returns HTTP 503)

**Secrets location:**
- Development: `.env` file in backend root (copy from `.env.example`, never committed)
- Production: Environment variables set at runtime via deployment platform
- Example `.env.example` present at `backend/.env.example` documenting all required variables

## Webhooks & Callbacks

**Incoming:**
- None configured

**Outgoing:**
- None configured
- All integrations are request-response synchronous (no async webhooks)

## Data Exchange & API Contracts

**Frontend-to-Backend:**
- REST API over HTTP (axios client)
- Base URL: typically `http://localhost:8000` in development
- Endpoints under `/api/v1/` namespace
- JSON request/response bodies
- CORS enabled via middleware configuration

**Backend Database:**
- SQLAlchemy ORM handles all SQL generation
- Migration management via Alembic (currently using SQLAlchemy auto-generate for schema)
- Connection pooling: 5 pool_size, 10 max_overflow for PostgreSQL (configurable in `app/db/session.py`)

## Machine Learning & Matching Engine

**Matchmaking Pipeline:**
- scikit-learn 1.4.2 - Feature scaling, eligibility filtering
- XGBoost 2.0.3 - Gradient boosting classifier for admission probability prediction
- SHAP 0.45.0 - Feature importance analysis (explains why a school matched)
- Implementation: `app/services/match_service.py` and `app/services/matchmaking_service.py`
- Output stored as: `match_score`, `eligibility_pass`, `shap_explanation` JSONB on StudentSchoolTarget table
- No external ML platform (no Vertex AI, SageMaker, DataRobot, etc.)

## Report Generation

**Plan Document Rendering:**
- Jinja2 3.1.4 - HTML template rendering for academic plan documents
- Implementation: `app/services/plan_generator.py`
- Output: Static HTML with embedded CSS (printable, no external CSS dependencies)
- Chart library: Chart.js 4.x (loaded from CDN in rendered HTML)
- Timeline visualization: SVG inline rendering
- Delivery: Backend endpoint `GET /api/v1/students/{id}/plan` returns HTML; frontend renders in iframe or full-page route

---

*Integration audit: 2026-04-24*
