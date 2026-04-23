# IAM Operations Triage Hub

Production-oriented scaffold for an IAM incident triage platform with:
- Frontend: Next.js 16.x (App Router, TypeScript, Tailwind v4 + shadcn-style UI)
- Middleware: FastAPI (ServiceNow sync + Kindo triage orchestration)
- Backend datastore: MongoDB

## Quick Start Guide

For setup, configuration, and first-use workflow, see [QUICKSTART.md](./QUICKSTART.md).

## Structure

- `frontend/` Next.js operations console
- `backend/` FastAPI middleware and integration services


## Local Setup

1. Copy environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

2. Install dependencies:

```bash
cd frontend && npm install
cd ../backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

3. Run locally:

```bash
# terminal 1
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# terminal 2
cd frontend && npm run dev
```

4. Optional Docker run:

```bash
docker compose up --build
```

## Notes

- Kindo endpoint shapes can vary by tenant. This scaffold normalizes common response keys.
- ServiceNow assignment-group filtering may require a group `sys_id` in some environments.
- For production: add auth, rate limiting, secret management, and robust retry/backoff queueing.
