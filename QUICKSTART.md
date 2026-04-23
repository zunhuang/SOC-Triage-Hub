# Detect and Respond - Quick Start User Guide

This guide gets you from a clean checkout to a working triage workflow.

## What You Get

- A FastAPI middleware service (`backend/`) that syncs ServiceNow incidents and orchestrates Kindo triage.
- A Next.js operations UI (`frontend/`) for dashboarding, triage, and settings.
- MongoDB-backed runtime data and settings.

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.12+
- MongoDB running locally or remotely
- ServiceNow credentials (instance URL, username, password/token, assignment group)
- Kindo API key and tenant URLs

## 1. Configure Environment

From the repository root:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Update `backend/.env` with real values for:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `SERVICENOW_INSTANCE_URL`
- `SERVICENOW_USERNAME`
- `SERVICENOW_PASSWORD`
- `SERVICENOW_ASSIGNMENT_GROUP`
- `KINDO_API_KEY`
- Optional runtime flags: `AUTO_TRIAGE_ENABLED`, `ENABLE_INTERNAL_SCHEDULER`

If your backend is not at `http://localhost:8000`, also update `frontend/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`

## 2. Start MongoDB

Make sure MongoDB is reachable at your configured `MONGODB_URI`.

Example (local default):

```bash
mongod --dbpath /usr/local/var/mongodb
```

## 3. Run the App (Local Development)

### Terminal 1 - Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Terminal 2 - Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

- UI: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/health>

## 4. Login

Use the built-in demo credentials:

- Username: `demo@deloitte.com`
- Password: `Deloitte123!`

## 5. First-Time Setup in the UI

### ServiceNow settings

Go to `Settings -> ServiceNow`:

1. Set Instance URL, API username, password/token, assignment group, poll interval.
2. Click `Save ServiceNow Config`.
3. Click `Test Connection`.

### Kindo settings and agents

Go to `Settings -> Kindo Agents`:

1. Set Kindo Tenant URL, Inference URL, API key.
2. Click `Save Kindo Settings`.
3. Click `Fetch Agents`.
4. Enable at least one agent of type `workflow` or `chatbot`.

### General settings

Go to `Settings -> General`:

1. Choose LLM provider.
2. Set log level and poll interval.
3. Optionally enable auto-triage.

## 6. Core Functionality Walkthrough

### Sync incidents from ServiceNow

- Open `Dashboard`.
- Click `Sync Now`.
- Confirm sync summary (`new`, `updated`, `unchanged`).

### Triage incidents

- Go to `Incidents`.
- Select one or more incidents.
- Click `Trigger Triage` for bulk triage.
- Or open a specific incident and click `Re-Triage`.

### Review triage output

In incident detail view you can inspect:

- Triage status and metadata
- AI summary/root-cause fields
- Remediation steps
- Activity timeline updates

### Close the loop

- Use `Mark Resolved` in incident detail when work is complete.
- Monitor recent events on the dashboard Activity panel.

## 7. Optional Automation Modes

### Internal scheduler (in-process)

Set in `backend/.env`:

- `ENABLE_INTERNAL_SCHEDULER=true`
- `SERVICENOW_POLL_INTERVAL_MINUTES=<1-60>`

Restart backend. The API will poll ServiceNow on that interval.

### External cron trigger

Call the cron endpoint from your scheduler:

```bash
curl -X POST http://localhost:8000/api/cron
```

If auto-triage is enabled, new incidents will be triaged automatically.

## 8. Docker Option

You can run frontend + backend with:

```bash
docker compose up --build
```

Notes:

- Compose expects `backend/.env` to exist.
- This compose file does **not** start MongoDB; use an external/local MongoDB and point `MONGODB_URI` to it.

## 9. Quick Troubleshooting

- `ServiceNow instance URL is still a placeholder`
  - Set a real `SERVICENOW_INSTANCE_URL` in `Settings -> ServiceNow` or `backend/.env`.
- `No active triage agent configured`
  - Fetch agents and enable at least one `workflow` or `chatbot` agent in `Settings -> Kindo Agents`.
- Backend fails on startup with env validation errors
  - Check required values in `backend/.env`.
- Frontend cannot reach API
  - Verify `NEXT_PUBLIC_API_BASE_URL` and backend health endpoint.

## 10. Useful API Endpoints

- `GET /health` - service health
- `GET /docs` - interactive API docs
- `POST /api/incidents/sync` - manual ServiceNow sync
- `GET /api/incidents` - incident listing/filtering
- `POST /api/kindo/triage` - trigger triage
- `GET /api/activity` - recent activity feed
- `PUT /api/settings` - save runtime settings
