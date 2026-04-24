# Detect and Respond

AI-powered SOC incident triage platform. Pulls incidents from Jira Data Center, sends them to Kindo AI agents for automated triage, and displays results in an operations dashboard.

- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn/ui)
- **Backend:** FastAPI (Jira sync + Kindo triage orchestration)
- **Database:** MongoDB Atlas

## Quick Start

For full setup and first-use walkthrough, see [QUICKSTART.md](./QUICKSTART.md).

## Project Structure

```
frontend/   Next.js operations console (port 3000)
backend/    FastAPI middleware and integration services (port 8000)
```

## Local Setup

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` and fill in:

- `MONGODB_URI` — MongoDB Atlas connection string
- `MONGODB_DB_NAME` — database name
- `KINDO_API_KEY` — your Kindo API key
- `JIRA_*` — Jira Data Center credentials (or configure in the UI later)

### 2. Install dependencies

**Backend (Python 3.12+):**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows CMD/PowerShell
# or: source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

**Frontend (Node.js 20+):**

```bash
cd frontend
npm install
```

### 3. Run locally (two terminals)

**Terminal 1 — Backend:**

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

### 4. Open the app

- UI: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

**Demo login:** `demo@deloitte.com` / `Deloitte123!`

## Notes

- Kindo endpoint shapes vary by tenant. The client tries multiple payload formats automatically.
- SSL verification is disabled for Kindo and MongoDB to work behind corporate proxies.
- For production: add real auth, rate limiting, secret management, and robust retry/backoff queueing.
