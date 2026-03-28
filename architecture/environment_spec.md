# Environment Specification
# Intelligent Academic Advisor — MVP
# Document Owner: System Architect
# Date: 2026-03-27
# Status: BASELINE

---

## REQ-IDs Covered

REQ-003, REQ-005, REQ-006, REQ-010

---

## 1. Overview

Environment variables are the only permitted mechanism for externally configuring the application. Hard-coded configuration values in source code are not acceptable. The backend reads variables at startup; the frontend reads variables at build time (Vite convention).

Development and production environments differ primarily in the values of secrets and origin allowlists, not in the set of variables required. All variables listed here are required in both environments unless otherwise noted.

---

## 2. Backend Environment Variables

The FastAPI backend process requires the following environment variables. These must be present in the process environment at startup. A missing required variable must cause the application to fail immediately with a clear error message rather than starting in a broken state.

---

### DATABASE_URL

| Property | Value |
|----------|-------|
| **Purpose** | PostgreSQL connection string used by the ORM to connect to the database. |
| **Type** | String |
| **Required** | Yes |
| **Dev example** | `postgresql://advisor_user:devpassword@localhost:5432/advisor_dev` |
| **Prod example** | `postgresql://advisor_user:StrongProdPassword123@db.internal:5432/advisor_prod` |

**Dev vs Prod difference:** In development, the database typically runs on `localhost` with a permissive password. In production, the host is a dedicated database server on a private network; the password must be strong and managed via a secrets manager (e.g., environment injection by the deployment platform). The database name should differ between environments to prevent accidental cross-environment data access.

**Format:** `postgresql://<user>:<password>@<host>:<port>/<dbname>`

**Security note:** This value contains credentials. It must never be committed to source control.

---

### SECRET_KEY

| Property | Value |
|----------|-------|
| **Purpose** | Cryptographic secret used to sign and verify JWT tokens. All tokens signed with this key are trusted by the backend. |
| **Type** | String (minimum 32 bytes of cryptographically random data, hex- or base64-encoded) |
| **Required** | Yes |
| **Dev example** | `dev-secret-key-do-not-use-in-production-abc123` |
| **Prod example** | *(generated with `openssl rand -hex 32`; value is opaque and unique per deployment)* |

**Dev vs Prod difference:** Development may use a fixed, predictable value for convenience (it should not be shared publicly). Production must use a randomly generated value of at least 256 bits. Rotating the production `SECRET_KEY` invalidates all currently issued tokens; counselors will be required to log in again.

**Security note:** This value must never be committed to source control. It must be treated with the same sensitivity as a database password.

---

### ALGORITHM

| Property | Value |
|----------|-------|
| **Purpose** | Identifies the JWT signing algorithm used with `SECRET_KEY`. |
| **Type** | String |
| **Required** | Yes |
| **Dev example** | `HS256` |
| **Prod example** | `HS256` |

**Dev vs Prod difference:** No difference. `HS256` (HMAC-SHA256) is the standard symmetric algorithm for MVP. This variable is externalised to allow future migration to an asymmetric algorithm (e.g., `RS256`) without code changes.

**Valid values:** `HS256`, `HS384`, `HS512`. `RS256` is reserved for future use.

---

### ACCESS_TOKEN_EXPIRE_MINUTES

| Property | Value |
|----------|-------|
| **Purpose** | Number of minutes after issuance before a JWT access token expires and the counselor must log in again. |
| **Type** | Integer (positive) |
| **Required** | Yes |
| **Dev example** | `60` |
| **Prod example** | `30` |

**Dev vs Prod difference:** Development uses a longer expiry (60 minutes or more) to avoid frequent re-authentication during manual testing. Production uses a shorter expiry (30 minutes recommended) to reduce the window of exposure if a token is compromised.

---

### CORS_ORIGINS

| Property | Value |
|----------|-------|
| **Purpose** | Comma-separated list of allowed origins for CORS preflight requests. The FastAPI backend will only accept cross-origin requests from these origins. |
| **Type** | String (comma-separated URLs, no trailing slashes) |
| **Required** | Yes |
| **Dev example** | `http://localhost:5173,http://localhost:3000` |
| **Prod example** | `https://advisor.example.com` |

**Dev vs Prod difference:** Development allows localhost origins on the ports used by the Vite development server (default 5173) and any alternative dev port. Production must list only the exact origin(s) of the deployed React frontend. Wildcard `*` must not be used in production.

**Parsing note:** The backend must split this value on commas and trim whitespace from each entry before passing the resulting list to the CORS middleware.

---

## 3. Frontend Environment Variables

The React frontend is built with Vite. Vite exposes environment variables to the browser bundle at build time. All frontend environment variables must be prefixed with `VITE_` to be included in the build. These variables are embedded in the compiled JavaScript bundle and are therefore visible to anyone who inspects the browser assets; secrets must never be placed here.

---

### VITE_API_BASE_URL

| Property | Value |
|----------|-------|
| **Purpose** | Base URL of the FastAPI backend API. All frontend HTTP requests are constructed by prepending this value to the endpoint path. |
| **Type** | String (URL without trailing slash) |
| **Required** | Yes |
| **Dev example** | `http://localhost:8000` |
| **Prod example** | `https://api.advisor.example.com` |

**Dev vs Prod difference:** In development, the FastAPI server runs locally on port 8000 (default). In production, the API is served from a dedicated domain or subdomain behind a reverse proxy (e.g., nginx, a cloud load balancer). The frontend build pipeline must supply the correct value for each target environment.

**Usage pattern:** All API calls in the frontend use the form `${VITE_API_BASE_URL}/api/v1/<path>`.

**Security note:** This value is public (visible in browser developer tools). It must not contain any secret or credential.

---

## 4. Environment Files Summary

| File | Purpose | Committed to source control? |
|------|---------|------------------------------|
| `.env` | Backend defaults for local development | No — add to `.gitignore` |
| `.env.example` | Template showing all variable names with placeholder values | Yes — safe to commit |
| `.env.local` (frontend) | Frontend dev values (Vite convention) | No — add to `.gitignore` |
| `.env.local.example` | Frontend template | Yes — safe to commit |

Production values must be injected by the deployment platform (e.g., Docker secrets, cloud provider environment variable management, CI/CD pipeline secrets store) and must never be stored in source-controlled files.

---

## 5. Variable Cross-Reference

| Variable | Tier | Used By |
|----------|------|---------|
| DATABASE_URL | Backend | ORM (SQLAlchemy) database engine initialisation |
| SECRET_KEY | Backend | JWT signing and verification (python-jose or PyJWT) |
| ALGORITHM | Backend | JWT algorithm selection |
| ACCESS_TOKEN_EXPIRE_MINUTES | Backend | JWT `exp` claim computation at login |
| CORS_ORIGINS | Backend | FastAPI CORS middleware allowed origins list |
| VITE_API_BASE_URL | Frontend | Base URL prepended to all fetch/axios API calls |
