# Detect and Respond - Quick Start Guide

This guide gets you from a clean checkout to a working triage workflow.

## What You Get

- A FastAPI middleware service (`backend/`) that syncs Jira Data Center incidents and orchestrates Kindo AI triage.
- A Next.js operations UI (`frontend/`) for dashboarding, triage, and settings.
- MongoDB Atlas as the runtime data store.

## Prerequisites

- Python 3.12+
- Node.js 20+ / npm 10+
- MongoDB Atlas account (or local MongoDB)
- Jira Data Center credentials (base URL, username, password/token)
- Kindo API key

## 1. Configure Environment

From the repository root:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` with real values for:

- `MONGODB_URI` — Atlas connection string (direct or SRV)
- `MONGODB_DB_NAME` — database name (e.g. `SOC-triage-hub`)
- `KINDO_API_KEY` — your Kindo tenant API key
- `JIRA_BASE_URL` — e.g. `https://jira.company.com`
- `JIRA_USERNAME` — Jira API user
- `JIRA_PASSWORD` — Jira password or API token
- `JIRA_JQL` — JQL filter for which issues to sync
- Optional: `AUTO_TRIAGE_ENABLED`, `ENABLE_INTERNAL_SCHEDULER`

If your backend is not at `http://localhost:8000`, also update `frontend/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`

## 2. Install Dependencies

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows CMD/PowerShell
# or: source venv/bin/activate  # macOS/Linux/Git Bash
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## 3. Run Locally (Two Terminals)

### Terminal 1 — Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Open:

- UI: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## 4. Login

Use the built-in demo credentials:

- Username: `demo@deloitte.com`
- Password: `Deloitte123!`

## 5. First-Time Setup in the UI

### Jira settings

Go to `Settings -> Jira Data Center`:

1. Set Base URL, username, password/token, JQL filter, poll interval.
2. Click `Save Jira Config`.
3. Click `Test Connection`.

### Kindo settings and agents

Go to `Settings -> Kindo Agents`:

1. Set Kindo Tenant URL (e.g. `https://api.kindo.deloitte.com/v1`), Inference URL, API key.
2. Click `Save Kindo Settings`.
3. Click `Fetch Agents` to sync available agents.
4. Use the search bar to find agents, then enable the ones you want for triage.

### General settings

Go to `Settings -> General`:

1. Choose LLM provider.
2. Set log level and poll interval.
3. Optionally enable auto-triage.

## 6. Core Workflow

### Sync incidents from Jira

- Open `Dashboard`.
- Click `Sync Now`.
- Confirm sync summary (`new`, `updated`, `unchanged`, `closed`).

### Triage incidents

- Go to `Incidents`.
- Select one or more incidents.
- Click `Trigger Triage` for bulk triage.
- Or open a specific incident and click `Re-Triage`.

### Review triage output

In incident detail view:

- The **AI Triage Analysis** panel shows the full agent output.
- Triage status updates automatically (polls every 5 seconds during triage).
- Run metadata (agent ID, run ID, completion time) is in the collapsible section.

### Close the loop

- Use `Mark Resolved` in incident detail when work is complete.
- Monitor recent events on the dashboard Activity panel.

## 7. Optional Automation

### Internal scheduler

Set in `backend/.env`:

- `ENABLE_INTERNAL_SCHEDULER=true`
- `JIRA_POLL_INTERVAL_MINUTES=5` (1-60)

Restart backend. The API will poll Jira on that interval and optionally auto-triage new incidents.

### External cron trigger

```bash
curl -X POST http://localhost:8000/api/cron
```

## 8. Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend SSL errors on startup | Corporate proxy intercepting TLS. The app already has SSL bypass enabled for MongoDB and Kindo. Check your Atlas network access list. |
| `No active triage agent configured` | Go to Settings -> Kindo Agents, fetch agents, and enable at least one. |
| Backend fails with env validation | Check required values in `backend/.env` (`MONGODB_URI`, `MONGODB_DB_NAME`, `KINDO_API_KEY`). |
| Frontend cannot reach API | Verify `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` and check `http://localhost:8000/health`. |
| Port 8000 already in use | Kill the old process: `netstat -ano | findstr :8000` then `taskkill /PID <pid> /F`. |
| Agents page stuck loading | The endpoint fetches details for each agent. If it takes too long, check Kindo API connectivity. |

## 9. Useful API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Service health |
| `GET` | `/docs` | Interactive API docs |
| `POST` | `/api/incidents/sync` | Trigger Jira sync |
| `GET` | `/api/incidents` | List/filter incidents |
| `POST` | `/api/kindo/triage` | Trigger AI triage |
| `GET` | `/api/kindo/agents` | List and sync Kindo agents |
| `GET` | `/api/activity` | Recent activity feed |
| `GET/PUT` | `/api/settings` | Read/write app config |
| `POST` | `/api/jira/test` | Test Jira connection |
