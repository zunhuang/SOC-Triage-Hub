# CLAUDE.md — Detect and Respond (SOC Triage Hub)

## Project Overview

**Detect and Respond** is an AI-powered SOC (Security Operations Center) triage platform. It syncs incidents from Jira Data Center, sends them to Kindo AI agents for automated investigation and triage, and displays results in a Deloitte-branded operations dashboard. Triage results can be posted back to Jira as comments.

The data store is MongoDB Atlas (not local MongoDB). Settings configured via the UI are stored in MongoDB and override `.env` file values.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 16.1.6 |
| Frontend | React | 19.2.4 |
| Frontend | Tailwind CSS | 4.x |
| Frontend | Radix UI (shadcn) | Latest |
| Frontend | SWR | 2.3.6 |
| Frontend | react-markdown + remark-gfm | Latest |
| Frontend | @tailwindcss/typography | Latest |
| Frontend | TypeScript | 5.x |
| Backend | FastAPI | 0.121.2 |
| Backend | Python | 3.12 |
| Backend | Motor (async MongoDB) | 3.7.1 |
| Backend | Pydantic v2 | 2.x |
| Backend | httpx | 0.28.1 |
| Backend | APScheduler | 3.11.1 |
| Database | MongoDB Atlas | Cloud |
| AI Platform | Kindo AI (Deloitte) | REST API |

---

## Running Locally

### Option 1: Manual (two terminals)

**Terminal 1 — Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows CMD
# source venv/Scripts/activate # Git Bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Option 2: Docker
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with real credentials
docker compose up -d --build
```

- UI: http://localhost:3000
- API docs: http://localhost:8000/docs
- Demo login: `demo@deloitte.com` / `Deloitte123!`

### Required environment (`backend/.env`)

Copy from `backend/.env.example` and fill in:
- `MONGODB_URI` — MongoDB Atlas connection string (SRV or direct)
- `MONGODB_DB_NAME` — database name (e.g. `SOC-triage-hub`)
- `KINDO_API_KEY` — Kindo tenant API key

Jira and Kindo URLs can also be configured via the Settings UI after startup (stored in MongoDB, overrides `.env`).

---

## Directory Structure

```
SOC_Triage_Hub/
├── docker-compose.yml            # Production compose: backend + frontend
├── DEPLOY.md                     # EC2 deployment guide
├── QUICKSTART.md                 # Quick start guide
├── README.md                     # Project overview
│
├── backend/
│   ├── Dockerfile                # Production image (uvicorn, 2 workers)
│   ├── Dockerfile.dev            # Dev image (uvicorn --reload)
│   ├── requirements.txt
│   ├── .env                      # Runtime config (DO NOT COMMIT — gitignored)
│   ├── .env.example              # Template with placeholder values
│   └── app/
│       ├── main.py               # FastAPI entry, lifespan, router registration
│       ├── core/
│       │   ├── config.py         # Pydantic Settings (env vars → typed config)
│       │   ├── errors.py         # AppError, ExternalServiceError, NotFoundError
│       │   └── logger.py         # log_json(level, service, action, message, **extra)
│       ├── db/
│       │   └── mongo.py          # connect_mongo(), get_db(), close_mongo()
│       ├── routers/
│       │   ├── health.py         # GET /health
│       │   ├── incidents.py      # /api/incidents (CRUD, sync, delete, post-to-jira)
│       │   ├── kindo.py          # /api/kindo (agents, triage, triage-runs)
│       │   ├── jira.py           # /api/jira (test connection)
│       │   ├── settings.py       # /api/settings (read/write config)
│       │   ├── activity.py       # /api/activity (audit feed)
│       │   └── cron.py           # /api/cron (manual sync+triage)
│       ├── schemas/
│       │   ├── incidents.py      # IncidentPatchRequest
│       │   ├── kindo.py          # TriageRequest, AgentPatchRequest
│       │   ├── settings.py       # AppSettingsPayload, KindoSettingsPayload
│       │   └── common.py         # ErrorResponse
│       ├── services/
│       │   ├── jira_client.py    # JiraClient (fetch issues, test connection, add comment)
│       │   ├── sync_service.py   # run_jira_sync() — normalize, dedup, upsert
│       │   ├── kindo_client.py   # KindoClient (list agents, invoke, poll, inference)
│       │   ├── triage_orchestrator.py # queue_triage(), run_triage_for_incident()
│       │   ├── incident_normalization.py # canonicalize_triage_status()
│       │   ├── activity_service.py    # record_activity(), list_recent_activity()
│       │   └── settings_service.py    # get_settings(), upsert_settings()
│       └── utils/
│           ├── hash.py            # compute_sync_hash() — SHA256 for dedup
│           ├── markdown_to_jira.py # md_to_jira() — markdown → Jira wiki markup
│           └── serialization.py   # serialize() — ObjectId/datetime → JSON-safe
│
├── frontend/
│   ├── Dockerfile                 # Production multi-stage build
│   ├── Dockerfile.dev             # Dev image (npm run dev)
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json              # Path alias: @/* → ./*
│   ├── app/
│   │   ├── layout.tsx             # Root layout: AppHeader + AppSidebar + main + AppFooter
│   │   ├── page.tsx               # Redirects to /dashboard
│   │   ├── globals.css            # Tailwind v4 + @tailwindcss/typography + shadcn tokens
│   │   ├── login/page.tsx         # Demo login form
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx           # Severity cards, status counts, incident preview, activity
│   │   ├── incidents/
│   │   │   ├── page.tsx           # Incident workbench (search, filter, bulk triage)
│   │   │   └── [id]/page.tsx      # Incident detail (Jira data + AI triage + actions)
│   │   └── settings/
│   │       ├── page.tsx           # Settings hub (nav cards)
│   │       ├── general/page.tsx   # LLM provider, log level, auto-triage toggle
│   │       ├── agents/page.tsx    # Kindo agent list + config + search
│   │       └── jira/page.tsx      # Jira Data Center connection config
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
│   │   │   ├── IncidentDetail.tsx # Left panel: Jira metadata (collapsible description)
│   │   │   ├── TriagePanel.tsx    # Right panel: markdown-rendered AI results + Post to Jira
│   │   │   └── RemediationSteps.tsx  # Phased action plan (not used in detail view)
│   │   ├── settings/
│   │   │   ├── GeneralConfig.tsx
│   │   │   ├── JiraConfig.tsx     # Jira DC connection settings
│   │   │   ├── KindoConfig.tsx
│   │   │   ├── AgentSelector.tsx  # Table to browse/search/enable Kindo agents
│   │   │   └── SettingsBreadcrumb.tsx
│   │   └── ui/                    # shadcn/radix primitives (button, card, dialog, etc.)
│   ├── hooks/
│   │   ├── use-incidents.ts       # useIncidents(), useIncident(), syncIncidents(), triggerTriage(), deleteIncident(), postTriageToJira()
│   │   ├── use-activity.ts        # useActivityFeed()
│   │   └── use-settings.ts        # useAppSettings(), useKindoAgents()
│   ├── lib/
│   │   ├── api-client.ts          # apiClient.get/post/put/patch/delete — wraps fetch()
│   │   ├── env.ts                 # NEXT_PUBLIC_API_BASE_URL (default: http://localhost:8000)
│   │   ├── demo-auth.ts           # Demo creds: demo@deloitte.com / Deloitte123!
│   │   ├── triage-status.ts       # STATUS_MAP + canonicalizeTriageStatus()
│   │   └── utils.ts               # cn() for Tailwind class merging
│   └── types/
│       ├── incident.ts            # Incident, TriageResults, ActivityFeedEntry
│       └── settings.ts            # AppSettings, JiraSettings, KindoSettings, Agent
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
| DELETE | `/api/incidents/{id}` | routers/incidents.py | Delete incident and associated triage runs |
| POST | `/api/incidents/{id}/post-to-jira` | routers/incidents.py | Post triage results as Jira comment |
| POST | `/api/incidents/sync` | routers/incidents.py | Trigger Jira sync |
| GET | `/api/kindo/agents` | routers/kindo.py | List and sync Kindo agents (CDA filter) |
| PATCH | `/api/kindo/agents/{id}` | routers/kindo.py | Enable/disable agent |
| POST | `/api/kindo/triage` | routers/kindo.py | Queue incidents for AI triage |
| GET | `/api/kindo/triage-runs` | routers/kindo.py | List recent triage runs |
| GET | `/api/kindo/runs/{run_id}` | routers/kindo.py | Get triage run result |
| POST | `/api/jira/test` | routers/jira.py | Test Jira DC connection |
| GET | `/api/settings` | routers/settings.py | Read app config |
| PUT | `/api/settings` | routers/settings.py | Save app config |
| GET | `/api/activity` | routers/activity.py | Recent activity feed (last 50) |
| POST | `/api/cron` | routers/cron.py | Manual sync + optional auto-triage |

---

## MongoDB Collections

### `incidents`
Each document represents one Jira incident with triage results attached.
```
{
  _id: ObjectId,
  jiraKey: string,                  # "MXDRTBA-3142"
  jiraId: string,                   # Jira issue ID
  project: string,                  # "MXDRTBA"
  projectName: string,              # "MXDR Test Bed A"
  summary: string,
  description: string,
  priority: string,                 # "High", "Medium", etc.
  priorityRank: int (1-5),
  status: string,                   # "In Queue", "In Progress", etc.
  assignee: string,
  mxdrModule: string,
  createdAt: datetime,
  updatedAt: datetime,
  lastSyncedAt: datetime,
  triageStatus: "For Triage" | "Triage In Progress" | "Triage Complete" | "Triage Failed" | "Resolved" | "Closed",
  triageResults: {
    agentOutput: string,            # Final report text (markdown)
    triageAgent: string,            # Kindo agent ID
    kindoRunId: string,
    completedAt: datetime
  },
  triagePostedToJira: bool,
  triagePostedAt: datetime,
  activityLog: [{ timestamp, action, actor, details }],
  syncHash: string,                 # SHA256 for dedup
}
```

### `agents`
Kindo agent metadata synced from the API. Only agents with "CDA" in the name are synced.
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
  kindoMetadata: object,            # Includes inputs[] — expected input field names
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
  jiraKey: string,
  kindoAgentId: string,
  kindoRunId: string,
  status: "running" | "completed" | "failed",
  startedAt: datetime,
  completedAt: datetime,
  input: object,
  output: object,
  error: string | null
}
```

### `app_settings`
Singleton configuration document (`{singleton: true}`). UI settings override `.env` values.
```
{
  singleton: true,
  llmProvider: "openai" | "anthropic" | "gemini",
  autoTriageEnabled: bool,
  logLevel: string,
  pollIntervalMinutes: int,
  selectedTriageAgentId: string | null,
  jira: { baseUrl, username, password, jql, pollIntervalMinutes },
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

### Incident Sync (Jira DC → MongoDB)
1. `POST /api/incidents/sync` or scheduler triggers `run_jira_sync()`
2. `JiraClient.fetch_issues()` calls Jira REST API (`/rest/api/2/search`) with Basic Auth
3. JQL filter from settings (e.g. `project = MXDRTBA AND issuetype = Incident AND created >= -24h`)
4. Each issue is normalized: priority mapped, dates parsed, sync hash computed
5. Dedup: if `jiraKey` exists and `syncHash` matches → skip; if changed → update; if new → insert with `triageStatus="For Triage"`

### AI Triage (MongoDB → Kindo → MongoDB)
1. `POST /api/kindo/triage` with `{incidentIds, agentId?}` triggers `queue_triage_with_agent()`
2. Agent resolution: user-selected → settings `selectedTriageAgentId` → first active triage agent in DB
3. Incident status set to `"Triage In Progress"`
4. Agent's expected inputs are read from `kindoMetadata.inputs` (e.g. `["Client", "JIRA Ticket Number", "Module"]`)
5. Incident fields are mapped to those input names via `_build_agent_inputs()`
6. `KindoClient.invoke_agent()` sends `{agentId, inputs: [{name, value}, ...]}` to Kindo
7. Polls `get_run_result()` with exponential backoff (2s→30s, 10min timeout)
8. On success: extracts final report text from Kindo's parts array via `_extract_agent_report()`
9. Stores report in `triageResults.agentOutput`, status set to `"Triage Complete"` or `"Triage Failed"`

### Post Triage to Jira
1. `POST /api/incidents/{id}/post-to-jira` reads `triageResults.agentOutput`
2. Converts markdown to Jira wiki markup via `md_to_jira()`
3. Posts as a comment to the Jira issue via `JiraClient.add_comment()`

### Agent Selection Priority
1. `agentId` from the triage request (user picked in UI dropdown)
2. `selectedTriageAgentId` from `app_settings`
3. First agent in MongoDB where `isActive=true`, `purpose="triage"`, `agentType` in `["workflow", "chatbot"]`

---

## External API Integrations

### Kindo AI (Deloitte tenant)
- **Auth:** `api-key` + `x-api-key` headers with `KINDO_API_KEY`
- **Agent API base:** `KINDO_API_BASE_URL` (default: `https://api.kindo.deloitte.com/v1`)
  - `GET /agents/list` — list all agents
  - `GET /agents/{id}` — agent details (fetched in parallel with `asyncio.gather`)
  - `POST /agents/runs` — invoke agent with `{agentId, inputs: [{name, value}]}`
  - `GET /agents/{id}/runs/{run_id}` — poll run result
- **Inference API base:** `KINDO_INFERENCE_URL` (default: `https://llm.kindo.ai/v1`)
  - `POST /chat/completions` — OpenAI-compatible gateway to multiple LLM providers
- **SSL:** All httpx calls use `verify=False` for corporate SSL interception environments
- **Agent filtering:** Only agents with "CDA" in the name are synced to the DB
- **Input mapping:** Agent expected inputs (from `kindoMetadata.inputs`) are dynamically mapped to incident fields

### Jira Data Center
- **Auth:** HTTP Basic Auth (`JIRA_USERNAME` / `JIRA_PASSWORD`)
- **Endpoints:**
  - `GET /rest/api/2/search` — fetch issues by JQL
  - `GET /rest/api/2/myself` — test connection
  - `POST /rest/api/2/issue/{key}/comment` — post triage results as comment

---

## Frontend Patterns

### Data Fetching
All API calls go through `lib/api-client.ts` which wraps `fetch()` with:
- Base URL from `NEXT_PUBLIC_API_BASE_URL` env var
- JSON content type, no-store cache
- Custom `ApiError` class on failure
- Methods: `get`, `post`, `put`, `patch`, `delete`

SWR hooks in `hooks/` manage caching and auto-refresh:
- `useIncidents(query)` — refreshes every 5s if any incident is "Triage In Progress"
- `useIncident(id)` — refreshes every 5s during active triage
- `useActivityFeed()` — polls every 15s
- `useAppSettings()` / `useKindoAgents()` — one-time fetch

### Authentication
Demo-only: localStorage key `iam_demo_session` = `"authenticated"`. SessionGate component checks this and redirects to `/login` if missing. No real auth/JWT.

### Styling
- Tailwind CSS v4 with `@import "tailwindcss"` syntax (no tailwind.config.js)
- `@tailwindcss/typography` for `prose` class (renders markdown in TriagePanel)
- shadcn/ui components in `components/ui/`
- CSS variables for theming defined in `globals.css`
- Fonts: DM Sans (body) + IBM Plex Mono (code)
- Deloitte branding: black header bar with white logo (`public/deloitte-logo-white.svg`)

### Triage Output Rendering
- Kindo agent returns a JSON object with a `parts` array containing tool calls, step markers, and text blocks
- `_extract_agent_report()` (backend) and `parseAgentOutput()` (frontend) extract the final text block
- Output is rendered as markdown using `react-markdown` + `remark-gfm`

### Incident Detail Layout
Two-column split:
- **Left:** IncidentDetail (Jira fields with collapsible long descriptions)
- **Right:** TriagePanel (markdown-rendered AI report, "Post to Jira" button, run metadata)

---

## Important Conventions

### Backend
- All routes are async and use `Depends(get_db)` for MongoDB injection
- Custom exceptions: `AppError` (400), `ExternalServiceError` (502), `NotFoundError` (404)
- All MongoDB documents pass through `serialize()` before API response (ObjectId → str, datetime → ISO)
- Logging via `log_json(level, service, action, message, **extra)` — structured JSON logs
- Triage runs execute as `asyncio.create_task()` — fire-and-forget background tasks
- Settings use singleton pattern: `{singleton: true}` filter in `app_settings` collection
- MongoDB Atlas connection uses `tls=True, tlsAllowInvalidCertificates=True` for corporate SSL environments

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
- `backend/app/models/incident.py`
- `backend/app/routers/auth.py` (not registered in main.py)
- `backend/app/routers/users.py` (not registered in main.py)
- `backend/app/utils/auth.py` (JWT utils, missing dependencies)
- `backend/app/middleware/rbac.py`
- `frontend/components/protected-route.tsx`
- `frontend/components/incidents/RemediationSteps.tsx` (exists but not used in detail view)

These files depend on packages NOT in `requirements.txt` (sqlalchemy, python-jose, passlib). Do not import them without adding dependencies.

---

## Docker

### Production (docker-compose.yml)
- `soc_backend` — Python 3.12, uvicorn with 2 workers (no --reload)
- `soc_frontend` — Node 20, multi-stage build, `npm start`
- No local MongoDB — connects to MongoDB Atlas via `MONGODB_URI` in `backend/.env`

### Development
- `backend/Dockerfile.dev` — uvicorn with `--reload`, source mounted as volume
- `frontend/Dockerfile.dev` — `npm run dev`, source mounted as volume

See `DEPLOY.md` for EC2 deployment instructions.

---

## When Customizing

- **Adding a new API endpoint:** Create route in `backend/app/routers/`, register in `main.py` with `app.include_router()`
- **Adding a new page:** Create `frontend/app/{route}/page.tsx`, it auto-registers via Next.js App Router
- **Adding a new component:** Place in `frontend/components/{section}/`, import with `@/components/...`
- **Modifying the incident schema:** Update normalization in `sync_service.py`, triage output in `triage_orchestrator.py`, TypeScript type in `frontend/types/incident.ts`
- **Adding a new MongoDB collection:** Create in `ensure_core_collections()` in `main.py`, add indexes there
- **Changing the AI triage output parsing:** Modify `_extract_agent_report()` in `triage_orchestrator.py`
- **Adding a new Kindo agent input mapping:** Update `_KINDO_INPUT_MAP` in `triage_orchestrator.py`
- **Changing branding:** Header in `AppHeader.tsx`, logo in `public/`, colors in `globals.css` CSS variables
