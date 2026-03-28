# Environment Specification — v2 Additions
# Intelligent Academic Advisor — v2 Pipeline
# Document Owner: System Architect
# Date: 2026-03-27
# Status: BASELINE
# Note: This file defines NEW environment variables only. All v1 variables in
#       architecture/environment_spec.md remain required. Read both files together.

---

## REQ-IDs Covered

REQ-046, REQ-049, REQ-050, REQ-067

---

## 1. Overview

Three new backend environment variables are introduced in v2 to support:
- ML model loading for the XGBoost matchmaking module (optional).
- Transcript file storage location (required).
- Async plan generation timeout enforcement (required).

All three are backend-only variables. No new frontend variables are introduced in v2;
the frontend continues to communicate with the backend exclusively through the
existing `VITE_API_BASE_URL` base URL.

---

## 2. New Backend Environment Variables

---

### ML_MODEL_PATH

| Property | Value |
|----------|-------|
| **Purpose** | Filesystem path to the trained XGBoost model file (serialized with `joblib` or `pickle`). When this variable is set and the file exists at startup, the ML scoring module loads the model. When unset or pointing to a missing file, the matching engine falls back to weighted scoring only. |
| **Type** | String (absolute filesystem path) |
| **Required** | No — optional |
| **Dev example** | `/app/models/xgboost_admission_v1.joblib` |
| **Prod example** | `/app/models/xgboost_admission_v1.joblib` |

**Dev vs Prod difference:** In development and early MVP deployment, the ML model
will not be trained yet. Omitting this variable activates the rule-only fallback path
(REQ-046). Once historical outcome data has been collected and a model is trained,
this path is set to the serialized model file. The application does not need to restart
when the model is updated; however, the model is loaded once at startup — a restart
is required to reload a new model file.

**Fallback behaviour:** When `ML_MODEL_PATH` is absent or the file does not exist:
- `ml_model_used` in match responses is `false`.
- `ml_probability` is `null` for all schools.
- `fit_score` equals `weighted_score` directly.
- SHAP values are not computed; `shap_explanation` remains `null` on
  StudentSchoolTarget records.

**Security note:** The model file is a binary artifact. It must not contain
injected payloads. The backend must validate that the file path does not escape
the intended model directory (path traversal guard).

---

### UPLOAD_DIR

| Property | Value |
|----------|-------|
| **Purpose** | Absolute filesystem path to the directory where uploaded transcript files are stored. The backend writes incoming transcript files to this directory and reads them during background parsing. |
| **Type** | String (absolute filesystem path to a writable directory) |
| **Required** | Yes |
| **Dev example** | `/app/uploads` |
| **Prod example** | `/var/data/advisor/uploads` |

**Dev vs Prod difference:** In development with Docker Compose, this is typically a
named volume or bind-mounted local directory. In production, this should be a
persistent volume mount (not ephemeral container storage). The directory must exist
and be writable by the application process at startup; if it does not exist, the
application should fail to start with a clear error message.

**Storage layout:** Files are stored as
`{UPLOAD_DIR}/transcripts/{student_id}/{transcript_id}_{original_filename}`.
This namespacing prevents collisions across students and upload events.

**Security note:** The `UPLOAD_DIR` path must not be served as a static file
directory. Files are accessed only by the backend process via internal path.
The API never returns raw file system paths as navigable URLs; only logical
`transcript_id` values are exposed.

**Capacity guidance (MVP):** Assume transcript files average 2–5 MB. For a
single-school deployment with up to 200 students: 200 × 5 MB = 1 GB maximum.
Ensure the volume allocation exceeds this with headroom.

---

### PLAN_GENERATION_TIMEOUT_SECONDS

| Property | Value |
|----------|-------|
| **Purpose** | Maximum number of seconds the plan generation background task is allowed to run before being marked as `failed`. Guards against runaway generation tasks blocking resources. |
| **Type** | Integer (positive) |
| **Required** | Yes |
| **Dev example** | `30` |
| **Prod example** | `15` |

**Dev vs Prod difference:** Development may use a more generous timeout (30 s) to
accommodate slower local machines and debugging. Production should use a tighter
value (15 s) to avoid long-held async resources. The preferences.md SLA states plan
generation may take up to 10 seconds (REQ-049); the timeout must exceed 10 s but the
implementation should optimise to stay well within 10 s.

**Behaviour on timeout:** The background task catches the `TimeoutError`, sets
`plan_generation_jobs.status = "failed"` and
`plan_generation_jobs.error_message = "Plan generation exceeded timeout"`. The
`AcademicPlan` record is not written or updated. The frontend polling loop receives
`status: "failed"` and must present an appropriate error message to the user.

---

## 3. Updated Variable Cross-Reference

| Variable | Tier | Required | Used By |
|----------|------|----------|---------|
| DATABASE_URL | Backend | Yes | ORM (SQLAlchemy) database engine |
| SECRET_KEY | Backend | Yes | JWT signing and verification |
| ALGORITHM | Backend | Yes | JWT algorithm selection |
| ACCESS_TOKEN_EXPIRE_MINUTES | Backend | Yes | JWT expiry computation |
| CORS_ORIGINS | Backend | Yes | CORS middleware |
| ML_MODEL_PATH | Backend | No (optional) | ML service module (XGBoost loader) |
| UPLOAD_DIR | Backend | Yes | Transcript upload handler, async parse task |
| PLAN_GENERATION_TIMEOUT_SECONDS | Backend | Yes | Async plan generation task runner |
| VITE_API_BASE_URL | Frontend | Yes | Base URL for all API calls |

---

## 4. Updated Environment Files Guidance

The `.env.example` file in the repository root must be updated to include the three
new variables with placeholder values:

```
# v2 additions (see architecture/environment_spec_v2.md)
ML_MODEL_PATH=          # Optional. Leave empty if model not yet trained.
UPLOAD_DIR=/app/uploads
PLAN_GENERATION_TIMEOUT_SECONDS=30
```

The `.env` file (not committed) must define `UPLOAD_DIR` and
`PLAN_GENERATION_TIMEOUT_SECONDS`. `ML_MODEL_PATH` may be left empty until a model
is available.
