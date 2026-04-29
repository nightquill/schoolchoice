# Deployment Guide

Deploy DataPilot to production using Vercel (frontend), Railway (backend), and Neon (database). You can go from zero to a running production instance in under an hour.

## Prerequisites

- GitHub account with the repository pushed
- [Vercel](https://vercel.com) account (free tier works)
- [Railway](https://railway.app) account (Starter plan or higher)
- [Neon](https://neon.tech) account (free tier works)
- Node.js 20+ (for local Vercel CLI setup)
- Python 3.10+ (for running seed scripts locally)

## 1. Database (Neon)

1. Create a new project at [Neon Console](https://console.neon.tech)
2. Create a database (the default `neondb` is fine)
3. Copy the connection string from **Connection Details**
4. Append `?sslmode=require` if not already present. The full format is:

   ```
   postgresql+psycopg2://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   **Important:** The `?sslmode=require` suffix is mandatory. Without it, connections will fail because Neon enforces TLS on all connections.

5. Save this connection string. You will use it as `DATABASE_URL` in Railway.

## 2. Backend (Railway)

1. Go to [Railway Dashboard](https://railway.app/dashboard) and create a new project
2. Add a new service from your GitHub repository
3. In the service settings, set **Root Directory** to `backend`
   - This ensures Railway finds `requirements.txt` and the `app.main:app` module resolves correctly
   - Alternatively, `backend/railway.toml` already specifies the start command
4. Go to **Variables** in the service settings and add:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Neon connection string (from step 1) |
   | `SECRET_KEY` | Run `bash scripts/generate_secrets.sh` locally, copy the SECRET_KEY value |
   | `ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
   | `CORS_ORIGINS` | Your Vercel frontend URL (e.g., `https://your-app.vercel.app`) |
   | `AI_PROVIDER` | `gemini` (or your preferred provider) |
   | `AI_API_KEY` | Your AI provider API key (optional; AI features degrade gracefully without it) |

5. Railway will auto-detect Python from `requirements.txt` and install dependencies
6. The start command is defined in `backend/railway.toml`:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
7. Deploy and note the generated Railway URL (e.g., `https://your-backend.up.railway.app`)

## 3. Frontend (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New Project**
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Vercel auto-detects Vite and configures:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. The `vercel.json` in the repo root provides SPA rewrite rules so React Router paths work correctly
6. If the frontend needs to know the backend URL at build time, add an environment variable:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | Your Railway backend URL (e.g., `https://your-backend.up.railway.app`) |

7. Deploy and note the generated Vercel URL

**Update CORS:** Go back to Railway and update `CORS_ORIGINS` to include the Vercel URL.

## 4. CI/CD (GitHub Actions)

The repository includes `.github/workflows/ci.yml` which:
- Runs `pytest` (backend) and `vitest` (frontend) as quality gates on every push and PR
- Deploys to Vercel and Railway automatically on push to `main` (only if tests pass)

### Setup GitHub Secrets

Add these secrets at **GitHub > Settings > Secrets and variables > Actions**:

| Secret | Where to get it |
|--------|----------------|
| `VERCEL_TOKEN` | [Vercel Dashboard](https://vercel.com/account/tokens) > Create Token |
| `VERCEL_ORG_ID` | Run `vercel link` locally in `frontend/`, then read `.vercel/project.json` > `orgId` |
| `VERCEL_PROJECT_ID` | Same `.vercel/project.json` > `projectId` |
| `RAILWAY_TOKEN` | [Railway Dashboard](https://railway.app) > Project > Settings > Tokens > Create project token |

**Getting Vercel IDs:**

```bash
cd frontend
npx vercel link    # follow prompts to link to your Vercel project
cat .vercel/project.json
# Copy orgId and projectId values
```

**Important:** Use a Railway **project token** (not an account token). Project tokens are scoped to a single project and are safer for CI.

## 5. Demo Data

To seed the database with demo users and sample data:

```bash
# Set DATABASE_URL to your Neon connection string
export DATABASE_URL="postgresql+psycopg2://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

# Run the seed script
python scripts/seed_demo.py
```

Alternatively, use Railway's shell to run the script directly on the deployed backend.

The seed script is idempotent (safe to re-run). It creates:
- An admin user and a counsellor user
- Sample students with grades and activities
- Schools and subjects from existing seed data

## 6. Verify

After deployment, check each of these:

- [ ] Frontend loads at the Vercel URL
- [ ] Login works with demo credentials (if seeded)
- [ ] Admin can access user management (Settings page)
- [ ] Student profiles load and display correctly
- [ ] AI features work (if `AI_API_KEY` is configured)
- [ ] Data import/export works
- [ ] Direct URL access works (e.g., navigating to `/students/123/profile` directly)

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql+psycopg2://user:pass@host/db?sslmode=require` |
| `SECRET_KEY` | Yes | JWT signing secret (64 hex chars) | `openssl rand -hex 32` |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token expiry (default: `30`) | `30` |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins | `https://your-app.vercel.app` |
| `AI_PROVIDER` | No | AI provider (default: `gemini`) | `gemini`, `openai`, `anthropic` |
| `AI_API_KEY` | No | AI provider API key | `sk-...` |
| `AI_MODEL` | No | Override default model | `gpt-4o` |
| `AI_BASE_URL` | No | Custom endpoint URL | `https://api.example.com/v1` |
| `AI_TIMEOUT` | No | AI request timeout seconds (default: `30`) | `60` |
| `UPLOAD_DIR` | No | File upload directory | `/tmp/uploads` |
| `PLAN_GENERATION_TIMEOUT_SECONDS` | No | Plan generation timeout (default: `120`) | `120` |

## Troubleshooting

### SSL connection error with Neon

```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) SSL connection has been closed unexpectedly
```

**Fix:** Ensure `?sslmode=require` is appended to your `DATABASE_URL`. Neon requires TLS on all connections.

### ModuleNotFoundError: No module named 'app'

```
ModuleNotFoundError: No module named 'app'
```

**Fix:** Set the Railway service Root Directory to `backend`. The Python application expects to run from the `backend/` directory where `app/` is a direct subdirectory.

### React Router paths return 404 on Vercel

Direct URL access (e.g., `/students/123/profile`) returns a 404 page.

**Fix:** Ensure `vercel.json` exists at the repo root with the SPA rewrite rule. The file should contain:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Startup validation error

```
Startup validation failed — insecure configuration detected:
  - SECRET_KEY must not be the default placeholder value.
```

**Fix:** Generate a proper secret key by running `bash scripts/generate_secrets.sh` and copying the `SECRET_KEY` value to your environment. Never use the default development key in production.

### Railway deploy fails with "no start command"

**Fix:** Ensure `backend/railway.toml` exists with the start command. Railway needs to know how to start your Python application:
```toml
[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
```
