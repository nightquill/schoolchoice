# Technology Stack

**Analysis Date:** 2026-04-24

## Languages

**Primary:**
- Python 3.9+ - Backend API, matchmaking engine, data processing
- JavaScript (ES2020+) - Frontend UI, routing, state management
- JSX - React component markup

**Secondary:**
- SQL - PostgreSQL database, migrations via Alembic
- Bash - Development scripts, environment setup

## Runtime

**Environment:**
- Python 3.9+ runtime for backend (uvicorn/ASGI)
- Node.js 18+ for frontend (Vite dev server)

**Package Manager:**
- pip (Python) - dependencies in `backend/requirements.txt`
  - Lockfile: implicit (requirements.txt pins exact versions)
- npm - dependencies in `frontend/package.json`
  - Lockfile: `frontend/package-lock.json` present

## Frameworks

**Core:**
- FastAPI 0.111.0 - REST API, request validation (Pydantic)
- React 19.2.4 - UI components, hooks, state management
- React Router DOM 7.13.2 - Client-side routing

**Testing:**
- pytest 8.2.0 - Python test runner
- pytest-asyncio 0.23.6 - Async test support for FastAPI
- httpx 0.27.0 - Async HTTP client for testing

**Build/Dev:**
- Vite 8.0.1 - Frontend bundler, dev server (HMR)
- @vitejs/plugin-react 6.0.1 - JSX/TSX support for Vite
- ESLint 9.39.4 - JavaScript/JSX linting (flat config)
- Ruff 0.4.4 - Python linter/formatter
- Alembic 1.13.1 - Database schema migrations
- Uvicorn[standard] 0.29.0 - ASGI server for FastAPI

## Key Dependencies

**Critical:**
- SQLAlchemy 2.0.30 - ORM for Python, database abstraction layer
- psycopg2-binary 2.9.9 - PostgreSQL adapter for Python
- Pydantic 2.7.1 - Data validation and serialization
- scikit-learn 1.4.2 - Machine learning (matchmaking model training)
- XGBoost 2.0.3 - Gradient boosting classifier (school matching predictions)
- SHAP 0.45.0 - Feature importance analysis (explainability for match scores)
- Jinja2 3.1.4 - HTML template rendering for academic plan documents

**Authentication & Authorization:**
- python-jose[cryptography] 3.3.0 - JWT token generation and validation
- passlib[bcrypt] 1.7.4 - Password hashing utilities
- bcrypt 3.2.2 - Bcrypt hashing implementation

**HTTP & Middleware:**
- axios 1.13.6 - Frontend HTTP client for API calls
- python-multipart 0.0.9 - Form data parsing for FastAPI
- Pydantic-settings 2.2.1 - Environment variable configuration management

**Editor & Formatting:**
- @tiptap/react 3.21.0 - Rich text editor for plan section editing
- @tiptap/starter-kit 3.21.0 - TipTap editor plugins and extensions
- @tiptap/pm 3.21.0 - ProseMirror document model (TipTap dependency)

**Development Tools:**
- @eslint/js 9.39.4 - ESLint core rules
- eslint-plugin-react-hooks 7.0.1 - React hooks linting rules
- eslint-plugin-react-refresh 0.5.2 - Vite refresh plugin linting
- @types/react 19.2.14 - TypeScript definitions for React (dev only)
- @types/react-dom 19.2.3 - TypeScript definitions for ReactDOM (dev only)
- globals 17.4.0 - Global variable definitions for ESLint

## Configuration

**Environment:**
- Configuration via Pydantic Settings (`app/core/config.py`)
- Reads from `.env` file (required at startup) with fallbacks for CORS_ORIGINS
- Key variables:
  - `DATABASE_URL` - PostgreSQL connection string (required)
  - `SECRET_KEY` - JWT signing key, minimum 32 bytes (required)
  - `ALGORITHM` - JWT algorithm, default HS256
  - `ACCESS_TOKEN_EXPIRE_MINUTES` - JWT expiry in minutes
  - `CORS_ORIGINS` - Comma-separated allowed origins
  - `GEMINI_API_KEY` - Google Generative AI API key (optional, enables plan chat)

**Build:**
- `frontend/vite.config.js` - Vite configuration (React plugin enabled)
- `frontend/eslint.config.js` - ESLint flat config (recommended, ecmaVersion 2020)
- `backend/app/core/config.py` - Pydantic Settings-based configuration loader
- Database migrations in `backend/alembic/` (auto-created via SQLAlchemy)

## Platform Requirements

**Development:**
- PostgreSQL 15+ (local instance via Homebrew)
- Python 3.9+ environment
- Node.js 18+ environment
- uvicorn for ASGI server
- Vite dev server on port 5173 (default)
- FastAPI backend on port 8000 (default)

**Production:**
- PostgreSQL 15+ hosted or containerized
- Python ASGI application server (uvicorn or gunicorn+uvicorn)
- Frontend: SPA static bundle (compiled from Vite build)
- Environment variables passed at runtime
- SSL/TLS termination at load balancer or reverse proxy

---

*Stack analysis: 2026-04-24*
