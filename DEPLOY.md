# Deploy on EC2 (Docker)

## Prerequisites

- EC2 instance with Docker and Docker Compose installed
- Ports 3000 and 8000 open in Security Group
- Git installed

## 1. Clone the repo

```bash
git clone https://github.com/zunhuang/SOC-Triage-Hub.git
cd SOC-Triage-Hub
```

## 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with real values:

```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=1
MONGODB_DB_NAME=SOC-triage-hub
KINDO_API_KEY=your_kindo_api_key
KINDO_API_BASE_URL=https://api.kindo.deloitte.com/v1
KINDO_INFERENCE_URL=https://llm.kindo.ai/v1
JIRA_BASE_URL=https://jira.company.com
JIRA_USERNAME=api_user
JIRA_PASSWORD=your_jira_password
JIRA_JQL=project = "SOC" AND statusCategory != Done
```

If the EC2 host is not `localhost` (e.g. accessed via IP or domain), update `NEXT_PUBLIC_API_BASE_URL` in `docker-compose.yml`:

```yaml
frontend:
  environment:
    NEXT_PUBLIC_API_BASE_URL: http://<EC2_PUBLIC_IP>:8000
```

Also update `FRONTEND_URL` for the backend CORS:

```yaml
backend:
  environment:
    FRONTEND_URL: http://<EC2_PUBLIC_IP>:3000
```

## 3. Build and run

```bash
docker compose up -d --build
```

This builds both containers and starts them in the background.

## 4. Verify

```bash
# Check containers are running
docker compose ps

# Check backend health
curl http://localhost:8000/health

# Check logs
docker compose logs -f
```

- UI: `http://<EC2_PUBLIC_IP>:3000`
- API docs: `http://<EC2_PUBLIC_IP>:8000/docs`
- Login: `demo@deloitte.com` / `Deloitte123!`

## 5. Common operations

```bash
# Stop
docker compose down

# Restart
docker compose restart

# Rebuild after code changes
git pull
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend can't reach MongoDB Atlas | Check `MONGODB_URI` in `backend/.env`. Ensure the EC2 IP is in Atlas Network Access list. |
| Frontend shows network error | Verify `NEXT_PUBLIC_API_BASE_URL` points to the EC2 public IP, not localhost. |
| SSL errors to Kindo/Jira | The app has SSL bypass enabled for corporate environments. Check Security Group allows outbound HTTPS. |
| Port already in use | `docker compose down` first, or change ports in `docker-compose.yml`. |
| Containers keep restarting | Check logs: `docker compose logs backend` |
