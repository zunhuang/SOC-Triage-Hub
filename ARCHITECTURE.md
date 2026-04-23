# Detect and Respond — Architecture Diagram

## What This App Does

**Detect and Respond** is an AI-powered incident management platform for security operations teams. It:

1. **Pulls IAM incidents** from ServiceNow (e.g., locked accounts, access requests, privilege escalations)
2. **Sends them to Kindo AI agents** for automated triage (root cause analysis, impact assessment, remediation planning)
3. **Presents results** in a Deloitte-branded operations dashboard for analysts to review, act on, and resolve

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                  │
│                                                                             │
│  ┌──────────────────────┐          ┌──────────────────────────────────────┐ │
│  │   ServiceNow ITSM    │          │         Kindo AI Platform           │ │
│  │                      │          │                                      │ │
│  │  Incident Table API  │          │  ┌────────────┐  ┌───────────────┐  │ │
│  │  (REST + Basic Auth) │          │  │ Agent API   │  │ Inference API │  │ │
│  │                      │          │  │ /agents/*   │  │ /chat/complet │  │ │
│  │  IAM incidents:      │          │  │             │  │               │  │ │
│  │  - Locked accounts   │          │  │ Invoke agent│  │ LLM calls     │  │ │
│  │  - Access requests   │          │  │ Poll results│  │ (GPT-4, etc.) │  │ │
│  │  - Privilege issues   │          │  └────────────┘  └───────────────┘  │ │
│  └──────────┬───────────┘          └──────────┬───────────────────────────┘ │
│             │                                  │                             │
└─────────────┼──────────────────────────────────┼─────────────────────────────┘
              │ HTTP (fetch incidents)            │ HTTP (invoke agents, poll results)
              │                                   │
              ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                     BACKEND  (FastAPI + Python 3.12)                        │
│                     Port 8000                                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API ROUTERS                                  │   │
│  │                                                                      │   │
│  │  /api/incidents      List, filter, update incidents                  │   │
│  │  /api/incidents/sync Trigger ServiceNow sync                        │   │
│  │  /api/kindo/agents   List & manage Kindo AI agents                  │   │
│  │  /api/kindo/triage   Queue incidents for AI triage                  │   │
│  │  /api/settings       Read/write app configuration                   │   │
│  │  /api/servicenow     Test ServiceNow connection                     │   │
│  │  /api/activity       Get activity feed / audit log                  │   │
│  │  /api/cron           Manual sync + auto-triage trigger              │   │
│  │  /health             Health check                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────┐  ┌────────────────────────────────────────┐  │
│  │     SERVICES             │  │     BACKGROUND JOBS                    │  │
│  │                          │  │                                        │  │
│  │  ServiceNowClient       │  │  APScheduler (optional)                │  │
│  │  - fetch_open_incidents  │  │  - Polls ServiceNow every N minutes   │  │
│  │  - test_connection       │  │  - Auto-triages new incidents         │  │
│  │                          │  │                                        │  │
│  │  KindoClient            │  │  asyncio.create_task()                 │  │
│  │  - list_agents           │  │  - Non-blocking triage execution      │  │
│  │  - invoke_agent          │  │  - Polls Kindo for results (2s→30s)   │  │
│  │  - get_run_result        │  │  - 10-minute timeout                  │  │
│  │  - inference             │  │                                        │  │
│  │                          │  └────────────────────────────────────────┘  │
│  │  SyncService             │                                              │
│  │  - Normalize SNOW data   │                                              │
│  │  - Dedup via SHA256 hash │                                              │
│  │                          │                                              │
│  │  TriageOrchestrator      │                                              │
│  │  - Queue triage jobs     │                                              │
│  │  - Parse AI output       │                                              │
│  │  - Extract remediation   │                                              │
│  │                          │                                              │
│  │  ActivityService         │                                              │
│  │  - Record audit entries  │                                              │
│  └──────────────────────────┘                                              │
│             │                                                               │
└─────────────┼───────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        MongoDB  (Port 27017)                                │
│                                                                             │
│  ┌──────────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌───────────┐│
│  │  incidents    │ │  agents  │ │ triage_runs │ │ settings │ │ activity  ││
│  │              │ │          │ │             │ │          │ │   _feed   ││
│  │ SNOW data    │ │ Kindo    │ │ Run status  │ │ Singleton│ │ Audit log ││
│  │ Triage results│ │ agent   │ │ Input/output│ │ LLM prov │ │ Timestamps││
│  │ Remediation  │ │ metadata │ │ Errors      │ │ SNOW cfg │ │ Actions   ││
│  │ Activity log │ │ Status   │ │ Timestamps  │ │ Kindo cfg│ │ Actors    ││
│  └──────────────┘ └──────────┘ └─────────────┘ └──────────┘ └───────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
              ▲
              │  REST API (JSON over HTTP)
              │
┌─────────────┼───────────────────────────────────────────────────────────────┐
│             │                                                               │
│                  FRONTEND  (Next.js 16 + React 19 + Tailwind)              │
│                  Port 3000                                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYOUT (Deloitte-branded)                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ AppHeader  [Deloitte Logo]  Detect and Respond         [Logout] │    │   │
│  │  ├────────┬────────────────────────────────────────────────────┤    │   │
│  │  │Sidebar │                 Main Content                       │    │   │
│  │  │        │                                                    │    │   │
│  │  │Dashboard│  (pages rendered here based on route)             │    │   │
│  │  │Incidents│                                                   │    │   │
│  │  │Settings │                                                   │    │   │
│  │  └────────┴────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PAGES                                                              │   │
│  │                                                                      │   │
│  │  /login          Demo login (localStorage session)                  │   │
│  │  /dashboard      Severity cards, status overview, incident preview  │   │
│  │  /incidents      Workbench: search, filter, bulk triage, paginate   │   │
│  │  /incidents/[id] Detail: SNOW data + AI triage + remediation steps  │   │
│  │  /settings/*     Configure ServiceNow, Kindo agents, LLM, logging  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DATA LAYER                                                         │   │
│  │                                                                      │   │
│  │  SWR Hooks:                                                         │   │
│  │  - useIncidents()  → GET /api/incidents (auto-refresh 5s if triage) │   │
│  │  - useIncident(id) → GET /api/incidents/:id                         │   │
│  │  - useActivityFeed() → GET /api/activity (poll every 15s)           │   │
│  │  - useAppSettings()  → GET /api/settings                            │   │
│  │  - useKindoAgents()  → GET /api/kindo/agents                       │   │
│  │                                                                      │   │
│  │  Actions:                                                           │   │
│  │  - syncIncidents()    → POST /api/incidents/sync                    │   │
│  │  - triggerTriage()    → POST /api/kindo/triage                      │   │
│  │  - saveSettings()     → PUT  /api/settings                          │   │
│  │  - testConnection()   → POST /api/servicenow/test                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Data Flow: Incident Lifecycle

```
  ① INGEST                ② TRIAGE                  ③ REVIEW & ACT
  ─────────               ────────                   ──────────────

  ServiceNow              Kindo AI                   Frontend UI
  ┌─────────┐             ┌─────────┐               ┌─────────────┐
  │ INC00123│  ──sync──▶  │ Analyze │  ──results──▶ │ Dashboard   │
  │ INC00124│             │ via LLM │               │ shows:      │
  │ INC00125│             │         │               │             │
  └─────────┘             │ Output: │               │ • Root cause│
                          │ -Category│               │ • Impact    │
  Triggered by:           │ -Root   │               │ • Confidence│
  • Manual [Sync Now]     │  cause  │               │ • Risk flags│
  • Auto-scheduler        │ -Impact │               │ • Remediate │
    (every N mins)        │ -Steps  │               │   steps     │
                          │ -Score  │               │ • Commands  │
                          └─────────┘               └─────────────┘
                                                          │
                          Triggered by:               Analyst can:
                          • Manual [Re-Triage]        • Filter/search
                          • Bulk select + triage      • Mark resolved
                          • Auto-triage on sync       • Copy commands
                                                      • View audit log
```

---

## Incident State Machine

```
  ┌───────────┐    sync from     ┌──────────────┐   user/auto    ┌──────────────────┐
  │ ServiceNow│───ServiceNow────▶│  For Triage   │───trigger────▶│ Triage In Progress│
  │ (source)  │                  └──────────────┘               └────────┬─────────┘
  └───────────┘                        ▲                                 │
                                       │ retry                   success │ failure
                                       │                          │      │
                              ┌────────┴──┐              ┌────────▼──┐  │
                              │  Triage   │◀─────────────│  Triage   │  │
                              │  Failed   │              │  Complete │  │
                              └───────────┘              └─────┬─────┘  │
                                                               │        │
                                                               ▼        │
                                                    ┌──────────────────┐│
                                                    │   Remediation    ││
                                                    │   Pending        ││
                                                    └────────┬─────────┘│
                                                             │          │
                                                    analyst  │          │
                                                    action   ▼          │
                                                    ┌────────────┐      │
                                                    │  Resolved  │◀─────┘
                                                    └─────┬──────┘
                                                          │
                                                          ▼
                                                    ┌────────────┐
                                                    │   Closed   │
                                                    └────────────┘
```

---

## Tech Stack Summary

```
┌────────────────────────────────────────────────────────────────┐
│ LAYER          │ TECHNOLOGY              │ PURPOSE              │
├────────────────┼─────────────────────────┼──────────────────────┤
│ Frontend       │ Next.js 16 / React 19  │ UI framework         │
│                │ Tailwind CSS 4          │ Styling              │
│                │ Radix UI (shadcn)       │ Accessible components│
│                │ SWR                     │ Data fetching/cache  │
│                │ TypeScript              │ Type safety          │
├────────────────┼─────────────────────────┼──────────────────────┤
│ Backend        │ FastAPI (Python 3.12)   │ REST API framework   │
│                │ Uvicorn                 │ ASGI server          │
│                │ Motor (async MongoDB)   │ Database driver      │
│                │ httpx                   │ HTTP client          │
│                │ APScheduler             │ Background jobs      │
│                │ Pydantic v2             │ Validation/schemas   │
├────────────────┼─────────────────────────┼──────────────────────┤
│ Database       │ MongoDB                 │ Document store       │
├────────────────┼─────────────────────────┼──────────────────────┤
│ AI / ML        │ Kindo AI Platform       │ Agent orchestration  │
│                │ OpenAI / Anthropic /    │ LLM inference        │
│                │ Google Gemini           │                      │
├────────────────┼─────────────────────────┼──────────────────────┤
│ Integration    │ ServiceNow Table API    │ Incident source      │
├────────────────┼─────────────────────────┼──────────────────────┤
│ Infra          │ Docker / Docker Compose │ Containerization     │
└────────────────┴─────────────────────────┴──────────────────────┘
```

---

## MongoDB Collections

| Collection      | Purpose                          | Key Index                      |
|-----------------|----------------------------------|--------------------------------|
| `incidents`     | Normalized ServiceNow incidents + AI triage results + remediation steps | `snowIncidentId` (unique), `triageStatus`, `severityRank+openedAt` |
| `agents`        | Kindo agent metadata & config    | `kindoAgentId` (unique)        |
| `triage_runs`   | Individual triage execution logs | `kindoRunId` (unique)          |
| `app_settings`  | Singleton app configuration      | `singleton: true`              |
| `activity_feed` | Audit trail of all actions       | `timestamp` (descending)       |

---

## API Endpoint Map

| Method | Endpoint                    | What It Does                                    |
|--------|-----------------------------|-------------------------------------------------|
| GET    | `/api/incidents`            | List incidents (paginated, filterable, sortable) |
| GET    | `/api/incidents/:id`        | Get single incident detail                      |
| PATCH  | `/api/incidents/:id`        | Update incident (status, notes)                 |
| POST   | `/api/incidents/sync`       | Pull latest from ServiceNow                     |
| GET    | `/api/kindo/agents`         | List available Kindo AI agents                  |
| PATCH  | `/api/kindo/agents/:id`     | Enable/disable/configure an agent               |
| POST   | `/api/kindo/triage`         | Queue incidents for AI triage                   |
| GET    | `/api/kindo/runs/:id`       | Get triage run result                           |
| GET    | `/api/settings`             | Read app configuration                          |
| PUT    | `/api/settings`             | Save app configuration                          |
| POST   | `/api/servicenow/test`      | Test ServiceNow connectivity                    |
| GET    | `/api/activity`             | Get recent activity feed                        |
| POST   | `/api/cron`                 | Manual sync + optional auto-triage              |
| GET    | `/health`                   | Health check                                    |

---

## User Journey (How an Analyst Uses It)

```
1. LOGIN ──▶ 2. DASHBOARD ──▶ 3. SYNC ──▶ 4. TRIAGE ──▶ 5. REVIEW ──▶ 6. RESOLVE
                  │                                           │
                  │  See severity                             │  View AI analysis:
                  │  breakdown &                              │  - Root cause
                  │  status counts                            │  - Impact assessment
                  │                                           │  - Confidence score
                  │                                           │  - Risk flags
                  ▼                                           │  - Remediation steps
           [Sync Now] pulls                                   │    with copy-paste
           incidents from                                     │    commands
           ServiceNow                                         │
                                                              ▼
                                                      [Mark Resolved]
```
