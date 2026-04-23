# CLAUDE.md — IAM Triage Hub

## Project Overview

**IAM Triage Hub** is an AI-powered incident management platform for IAM (Identity & Access Management) operations. It pulls incidents from ServiceNow, sends them to Kindo AI agents for automated triage (root cause analysis, impact assessment, remediation planning), and displays results in a Deloitte-branded operations dashboard.

This is a **reference implementation** being customized. The overall schema and structure must stay intact — changes should be additive or modify existing behavior without breaking the architecture.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 16.1.6 |
| Frontend | React | 19.2.4 |
| Frontend | Tailwind CSS | 4.1.17 |
| Frontend | Radix UI (shadcn) | Latest |
| Frontend | SWR | 2.3.6 |
| Frontend | TypeScript | 5.9.3 |
| Backend | FastAPI | 0.121.2 |
| Backend | Python | 3.12 |
| Backend | Motor (async MongoDB) | 3.7.1 |
| Backend | Pydantic v2 | 2.12.3 |
| Backend | httpx | 0.28.1 |
| Backend | APScheduler | 3.11.1 |
| Database | MongoDB | 7.x (Docker) |
| AI Platform | Kindo AI | REST API |

---

## Running Locally

```bash
# Start all services (MongoDB + backend + frontend)
docker compose -f docker-compose.yml up --build

# Frontend: http://localhost:3000
# Backend API docs: http://localhost:8000/docs
# MongoDB: localhost:27017
```

**Demo login:** `demo@deloitte.com` / `Deloitte123!`

**Required environment:** `backend/.env` — copy from `backend/.env.example` and fill in:
- `MONGODB_URI=mongodb://mongo:27017` (Docker) or `mongodb://localhost:27017` (local)
- `MONGODB_DB_NAME=iam-triage-hub`
- `KINDO_API_KEY=` (your Kindo tenant key)
- ServiceNow credentials (if connecting to a real instance)

---

## Directory Structure

```
iam_ops_kindo/
├── docker-compose.yml            # Dev compose: mongo + backend + frontend
├── compose.yaml                  # VS Code generated (frontend-only, ignore)
├── compose.debug.yaml            # VS Code debug (ignore)
│
├── backend/
│   ├── Dockerfile.dev            # Dev image (python:3.12-slim, uvicorn --reload)
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Runtime config (DO NOT COMMIT real keys)
│   ├── .env.example              # Template
│   └── app/
│       ├── main.py               # FastAPI entry point, lifespan, router registration
│       ├── core/
│       │   ├── config.py         # Pydantic Settings (env vars → typed config)
│       │   ├── errors.py         # AppError, ExternalServiceError, NotFoundError
│       │   └── logger.py         # log_json(level, service, action, message, **extra)
│       ├── db/
│       │   └── mongo.py          # connect_mongo(), get_db(), close_mongo()
│       ├── routers/
│       │   ├── health.py         # GET /health
│       │   ├── incidents.py      # /api/incidents (CRUD, sync)
│       │   ├── kindo.py          # /api/kindo (agents, triage)
│       │   ├── servicenow.py     # /api/servicenow (test connection)
│       │   ├── settings.py       # /api/settings (read/write config)
│       │   ├── activity.py       # /api/activity (audit feed)
│       │   └── cron.py           # /api/cron (manual sync+triage)
│       ├── schemas/
│       │   ├── incidents.py      # IncidentListQuery, IncidentPatchRequest, SyncSummary
│       │   ├── kindo.py          # TriageRequest, AgentPatchRequest
│       │   ├── settings.py       # AppSettingsPayload, ServiceNowSettingsPayload, KindoSettingsPayload
│       │   └── common.py         # ErrorResponse
│       ├── services/
│       │   ├── servicenow_client.py   # ServiceNowClient (fetch incidents, test connection)
│       │   ├── sync_service.py        # run_servicenow_sync() — normalize, dedup, upsert
│       │   ├── kindo_client.py        # KindoClient (list agents, invoke, poll, inference)
│       │   ├── triage_orchestrator.py # queue_triage(), run_triage_for_incident()
│       │   ├── activity_service.py    # record_activity(), list_recent_activity()
│       │   └── settings_service.py    # get_settings(), upsert_settings()
│       └── utils/
│           ├── hash.py            # compute_sync_hash() — SHA256 for dedup
│           └── serialization.py   # serialize() — ObjectId/datetime → JSON-safe
│
├── frontend/
│   ├── Dockerfile.dev             # Dev image (node:20-alpine, npm run dev)
│   ├── Dockerfile                 # Production multi-stage build
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json              # Path alias: @/* → ./*
│   ├── app/
│   │   ├── layout.tsx             # Root layout: AppHeader + AppSidebar + main + AppFooter
│   │   ├── page.tsx               # Redirects to /dashboard
│   │   ├── globals.css            # Tailwind v4 + shadcn theme tokens
│   │   ├── login/page.tsx         # Demo login form
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx           # Severity cards, status counts, incident preview, activity
│   │   ├── incidents/
│   │   │   ├── page.tsx           # Incident workbench (search, filter, bulk triage)
│   │   │   └── [id]/page.tsx      # Incident detail (SNOW data + AI triage + remediation)
│   │   └── settings/
│   │       ├── page.tsx           # Settings hub (nav cards)
│   │       ├── general/page.tsx   # LLM provider, log level, auto-triage toggle
│   │       ├── agents/page.tsx    # Kindo agent list + config
│   │       └── servicenow/page.tsx # ServiceNow connection config
│   ├── components/
│   │   ├── auth/SessionGate.tsx   # Auth guard (redirects to /login if no session)
│   │   ├── layout/
│   │   │   ├── AppHeader.tsx      # Black banner, Deloitte logo, logout
│   │   │   ├── AppSidebar.tsx     # Left nav: Dashboard, Incidents, Settings
│   │   │   └── AppFooter.tsx      # Page footer
│   │   ├── dashboard/
│   │   │   ├── SeverityCards.tsx   # 4 severity cards with counts
│   │   │   ├── IncidentTable.tsx  # Table with bulk triage dialog
│   │   │   ├── TriageStatusBadge.tsx  # Color-coded status badge
│   │   │   └── RecentActivity.tsx # Activity feed timeline
│   │   ├── incidents/
│   │   │   ├── IncidentDetail.tsx # Left panel: SNOW metadata + AI correlation
│   │   │   ├── TriagePanel.tsx    # Right panel: AI results, confidence, risk flags
│   │   │   └── RemediationSteps.tsx  # Phased action plan with commands
│   │   ├── settings/
│   │   │   ├── GeneralConfig.tsx
│   │   │   ├── ServiceNowConfig.tsx
│   │   │   ├── KindoConfig.tsx
│   │   │   ├── AgentSelector.tsx  # Table to browse/enable Kindo agents
│   │   │   └── SettingsBreadcrumb.tsx
│   │   └── ui/                    # shadcn/radix primitives (button, card, dialog, etc.)
│   ├── hooks/
│   │   ├── use-incidents.ts       # useIncidents(), useIncident(), syncIncidents(), triggerTriage()
│   │   ├── use-activity.ts        # useActivityFeed()
│   │   └── use-settings.ts        # useAppSettings(), useKindoAgents()
│   ├── lib/
│   │   ├── api-client.ts          # apiClient.get/post/put/patch — wraps fetch()
│   │   ├── env.ts                 # NEXT_PUBLIC_API_BASE_URL (default: http://localhost:8000)
│   │   ├── demo-auth.ts           # Demo creds: demo@deloitte.com / Deloitte123!
│   │   ├── triage-status.ts       # STATUS_MAP + canonicalizeTriageStatus()
│   │   └── utils.ts               # cn() for Tailwind class merging
│   └── types/
│       ├── incident.ts            # Incident, TriageResults, RemediationStep, ActivityFeedEntry
│       └── settings.ts            # AppSettings, ServiceNowSettings, KindoSettings, Agent
```

---

## API Endpoints

| Method | Endpoint | Router File | Purpose |
|--------|----------|-------------|---------|
| GET | `/` | main.py | App info |
| GET | `/health` | routers/health.py | Health check |
| GET | `/api/incidents` | routers/incidents.py | List incidents (paginated, filterable) |
| GET | `/api/incidents/{id}` | routers/incidents.py | Single incident detail |
| PATCH | `/api/incidents/{id}` | routers/incidents.py | Update incident (status, notes) |
| POST | `/api/incidents/sync` | routers/incidents.py | Trigger ServiceNow sync |
| GET | `/api/kindo/agents` | routers/kindo.py | List Kindo agents (syncs from API) |
| PATCH | `/api/kindo/agents/{id}` | routers/kindo.py | Enable/disable agent |
| POST | `/api/kindo/triage` | routers/kindo.py | Queue incidents for AI triage |
| GET | `/api/kindo/runs/{run_id}` | routers/kindo.py | Get triage run result |
| POST | `/api/servicenow/test` | routers/servicenow.py | Test ServiceNow connection |
| GET | `/api/settings` | routers/settings.py | Read app config |
| PUT | `/api/settings` | routers/settings.py | Save app config |
| GET | `/api/activity` | routers/activity.py | Recent activity feed (last 50) |
| POST | `/api/cron` | routers/cron.py | Manual sync + optional auto-triage |

---

## MongoDB Collections

### `incidents`
Core data store. Each document represents one ServiceNow incident with triage results attached.
```
{
  _id: ObjectId,
  snowIncidentId: string (unique),     # ServiceNow sys_id
  number: string,                       # "INC0001234"
  shortDescription: string,
  description: string,
  severity: "Critical" | "High" | "Medium" | "Low",
  severityRank: int (1-4),
  priority: string,                     # "2 - High"
  state: string,                        # "New", "In Progress", etc.
  assignmentGroup: string,
  assignedTo: string,
  caller: string,
  category: string,
  subcategory: string,
  configurationItem: string,
  openedAt: datetime,
  updatedAt: datetime,
  lastSyncedAt: datetime,
  triageStatus: "For Triage" | "Triage In Progress" | "Triage Complete" | "Triage Failed" | "Remediation Pending" | "Resolved" | "Closed",
  triageResults: {
    summary: string,
    rootCauseAnalysis: string,
    iamCategory: string,
    iamSubCategory: string,
    affectedSystems: string[],
    impactAssessment: string,
    confidenceScore: int (0-100),
    triageAgent: string,
    kindoRunId: string,
    rawAgentOutput: string (JSON),
    completedAt: datetime
  },
  remediationSteps: [{
    stepNumber: int,
    action: string,
    system: string,
    commands: string | null,
    automatable: bool,
    estimatedMinutes: int,
    status: "Pending" | "In Progress" | "Completed" | "Skipped"
  }],
  activityLog: [{ timestamp, action, actor, details }],
  snowRawData: object,                  # Full ServiceNow response
  syncHash: string,                     # SHA256 for dedup
  createdAt: datetime
}
```
**Indexes:** `snowIncidentId` (unique), `triageStatus`, `severityRank + openedAt`

### `agents`
Kindo agent metadata synced from the API.
```
{
  _id: ObjectId,
  kindoAgentId: string (unique),
  name: string,
  description: string,
  agentType: "workflow" | "chatbot" | "scheduled" | "trigger",
  agentTypeOverride: string | null,
  purpose: "triage" | "remediation" | "monitoring",
  isActive: bool,
  kindoMetadata: object,
  createdAt: datetime,
  lastSyncedAt: datetime
}
```

### `triage_runs`
Execution log for each triage invocation.
```
{
  _id: ObjectId,
  incidentId: ObjectId,
  snowIncidentNumber: string,
  kindoAgentId: string,
  kindoRunId: string (unique),
  status: "running" | "completed" | "failed",
  startedAt: datetime,
  completedAt: datetime,
  input: object,
  output: object,
  error: string | null
}
```

### `app_settings`
Singleton configuration document (`{singleton: true}`).
```
{
  singleton: true,
  llmProvider: "openai" | "anthropic" | "gemini",
  autoTriageEnabled: bool,
  logLevel: string,
  pollIntervalMinutes: int,
  selectedTriageAgentId: string | null,
  serviceNow: { instanceUrl, username, password, assignmentGroup, pollIntervalMinutes },
  kindo: { tenantUrl, inferenceUrl, apiKey },
  updatedAt: datetime
}
```

### `activity_feed`
Audit trail.
```
{ timestamp, action, message, actor, incidentNumber, level, extra }
```

---

## Key Data Flows

### Incident Sync (ServiceNow → MongoDB)
1. `POST /api/incidents/sync` or scheduler triggers `run_servicenow_sync()`
2. `ServiceNowClient.fetch_open_incidents()` calls ServiceNow Table API with Basic Auth
3. Filter: `assignment_group={GROUP}^stateIN1,2,3` (open incidents only)
4. Each incident is normalized: severity mapped (1→Critical, 2→High, etc.), dates parsed, sync hash computed
5. Dedup: if `snowIncidentId` exists and `syncHash` matches → skip; if changed → update; if new → insert with `triageStatus="For Triage"`
6. Activity recorded in `activity_feed`

### AI Triage (MongoDB → Kindo → MongoDB)
1. `POST /api/kindo/triage` with `{incidentIds, agentId?}` triggers `queue_triage_with_agent()`
2. Agent resolution: user-selected → settings `selectedTriageAgentId` → first active triage agent in DB
3. Incident status set to `"Triage In Progress"`
4. `KindoClient.invoke_agent()` sends `{inputs: {incidentId: "INC0001234", "re-triage": true}}` to Kindo
5. Polls `get_run_result()` with exponential backoff (2s→30s, 10min timeout)
6. On success: parses triage JSON + remediation steps → updates incident with `triageResults` and `remediationSteps`
7. Status set to `"Triage Complete"` or `"Triage Failed"`

### Agent Selection Priority
1. `agentId` from the triage request (user picked in UI dropdown)
2. `selectedTriageAgentId` from `app_settings`
3. First agent in MongoDB where `isActive=true`, `purpose="triage"`, `agentType` in `["workflow", "chatbot"]`

---

## External API Integrations

### Kindo AI (api.kindo.ai)
- **Auth:** `api-key` + `x-api-key` headers with `KINDO_API_KEY`
- **Agent API base:** `KINDO_API_BASE_URL` (default: `https://api.kindo.ai/v1`)
  - `GET /agents/list` (fallback: `/agents`) — list all agents
  - `GET /agents/{id}` — agent details
  - `POST /agents/runs` — invoke agent (tries multiple payload formats)
  - `GET /agents/{id}/runs/{run_id}` (fallback: `/runs/{run_id}`) — poll run result
- **Inference API base:** `KINDO_INFERENCE_URL` (default: `https://llm.kindo.ai/v1`)
  - `POST /chat/completions` — OpenAI-compatible chat (default model: `gpt-4o-mini`)
- The client tries multiple endpoint/payload variants because Kindo's API differs across tenants

### ServiceNow
- **Auth:** HTTP Basic Auth (`SERVICENOW_USERNAME` / `SERVICENOW_PASSWORD`)
- **Endpoint:** `{SERVICENOW_INSTANCE_URL}/api/now/table/incident`
- **Query:** `assignment_group={GROUP}^stateIN1,2,3`
- **Fields fetched:** sys_id, number, short_description, description, severity, priority, state, assignment_group, assigned_to, caller_id, category, subcategory, cmdb_ci, opened_at, sys_updated_on

---

## Frontend Patterns

### Data Fetching
All API calls go through `lib/api-client.ts` which wraps `fetch()` with:
- Base URL from `NEXT_PUBLIC_API_BASE_URL` env var
- JSON content type, no-store cache
- Custom `ApiError` class on failure

SWR hooks in `hooks/` manage caching and auto-refresh:
- `useIncidents(query)` — refreshes every 5s if any incident is "Triage In Progress"
- `useIncident(id)` — refreshes every 5s during active triage
- `useActivityFeed()` — polls every 15s
- `useAppSettings()` / `useKindoAgents()` — one-time fetch

### Authentication
Demo-only: localStorage key `iam_demo_session` = `"authenticated"`. SessionGate component checks this and redirects to `/login` if missing. No real auth/JWT.

### Styling
- Tailwind CSS v4 with `@import "tailwindcss"` syntax (no tailwind.config.js)
- shadcn/ui components in `components/ui/`
- CSS variables for theming defined in `globals.css`
- Fonts: DM Sans (body) + IBM Plex Mono (code)
- Deloitte branding: black header bar with white logo (`public/deloitte-logo-white.svg`)

### Triage Status Colors (TriageStatusBadge)
- For Triage → slate
- Triage In Progress → amber
- Triage Complete → emerald
- Triage Failed → red
- Remediation Pending → sky
- Resolved → dark emerald
- Closed → dark zinc

### Incident Detail Layout
Two-column split:
- **Left:** IncidentDetail (ServiceNow fields + AI correlation comparison)
- **Right:** TriagePanel (AI results, confidence bar, risk flags, evidence blocks) + RemediationSteps (phased action plan)

---

## Important Conventions

### Backend
- All routes are async and use `Depends(get_db)` for MongoDB injection
- Custom exceptions: `AppError` (400), `ExternalServiceError` (502), `NotFoundError` (404)
- All MongoDB documents pass through `serialize()` before API response (ObjectId → str, datetime → ISO)
- Logging via `log_json(level, service, action, message, **extra)` — structured JSON logs
- Triage runs execute as `asyncio.create_task()` — fire-and-forget background tasks
- Settings use singleton pattern: `{singleton: true}` filter in `app_settings` collection

### Frontend
- Path alias: `@/` maps to project root (e.g., `@/components/ui/button`)
- All pages except `/login` are wrapped in `SessionGate`
- Types in `types/incident.ts` and `types/settings.ts` mirror backend schemas
- Status normalization: `canonicalizeTriageStatus()` in `lib/triage-status.ts` maps various string formats to canonical enum values

---

## Dead Code (Do Not Import)

These files exist but are NOT used by the running application. They are leftover from a PostgreSQL-based auth system:
- `backend/app/config.py` (PostgreSQL settings — conflicts with `core/config.py`)
- `backend/app/database/postgres.py`
- `backend/app/models/postgres_models.py`
- `backend/app/models/schemas.py` (auth schemas)
- `backend/app/routers/auth.py` (not registered in main.py)
- `backend/app/routers/users.py` (not registered in main.py)
- `backend/app/utils/auth.py` (JWT utils, missing dependencies)
- `backend/app/middleware/rbac.py`

These files depend on packages NOT in `requirements.txt` (sqlalchemy, python-jose, passlib). Do not import them without adding dependencies.

---

## Docker

### Development (docker-compose.yml)
- `mongo:7` — MongoDB with healthcheck, data persisted in `mongo_data` volume
- `iam_ops_backend` — Python 3.12, uvicorn with `--reload`, source mounted as volume
- `iam_ops_frontend` — Node 20 Alpine, `npm run dev`, source mounted as volume
- Backend waits for MongoDB healthcheck before starting

### Production
- `frontend/Dockerfile` — multi-stage: build with `npm run build`, serve with `npm start`
- `backend/Dockerfile.dev` — currently used for both dev and prod (add a `backend/Dockerfile` for production without `--reload`)

---

## When Customizing

- **Adding a new API endpoint:** Create route in `backend/app/routers/`, register in `main.py` with `app.include_router()`
- **Adding a new page:** Create `frontend/app/{route}/page.tsx`, it auto-registers via Next.js App Router
- **Adding a new component:** Place in `frontend/components/{section}/`, import with `@/components/...`
- **Modifying the incident schema:** Update MongoDB document shape in `sync_service.py` (normalization), `triage_orchestrator.py` (triage output), `frontend/types/incident.ts` (TypeScript type)
- **Adding a new MongoDB collection:** Create in `ensure_core_collections()` in `main.py`, add indexes there
- **Changing the AI triage output format:** Modify parsing in `triage_orchestrator.py` lines 216-252
- **Changing branding:** Header in `AppHeader.tsx`, logo in `public/`, colors in `globals.css` CSS variables
