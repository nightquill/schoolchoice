---
name: frontend
description: Start the schoolchoice backend + frontend and open the site in the browser
---

Start the full schoolchoice stack (backend + frontend) and open the site in the browser.

Run these steps using the Bash tool:

1. Kill any existing processes on ports 8000 and 5173:
```
lsof -ti:8000 | xargs kill -9 2>/dev/null; lsof -ti:5173 | xargs kill -9 2>/dev/null; echo "ports cleared"
```

2. Ensure PostgreSQL is running:
```
brew services start postgresql@15 2>/dev/null; sleep 1; echo "postgres ready"
```

3. Start the backend in the background (use run_in_background: true):
```
cd /Users/bsg/Downloads/schoolchoice/backend && DATABASE_URL="postgresql+psycopg2://advisor:advisorsecret@localhost:5432/advisor_db" SECRET_KEY="dev-secret-key" ALGORITHM="HS256" ACCESS_TOKEN_EXPIRE_MINUTES="30" CORS_ORIGINS="http://localhost:5173" UPLOAD_DIR="/tmp/advisor_uploads" uvicorn app.main:app --host 0.0.0.0 --port 8000
```

4. Start the frontend in the background (use run_in_background: true):
```
cd /Users/bsg/Downloads/schoolchoice/frontend && npm run dev -- --port 5173
```

5. Wait for both servers to be ready, then open the browser:
```
sleep 5 && open http://localhost:5173
```

6. Confirm to the user that both servers are running and the site is open at http://localhost:5173.
