# Docker Deployment Guide: Sankara Events Platform

This repository includes a multi-stage production Docker setup that bundles the Vite React SPA frontend and the Node.js / Express API backend into a single container.

---

## 1. Quick Start with Docker Compose

### Prerequisites
- Docker Engine & Docker Compose installed
- A `.env` file with production credentials

### Run with Docker Compose:
```bash
# 1. Start both the Application and PostgreSQL Database
docker compose up -d --build

# 2. View live logs
docker compose logs -f app

# 3. Stop the services
docker compose down
```

The application will be live at: **`http://localhost:5000`** (or behind your reverse proxy / domain).

---

## 2. Standalone Docker Build (Existing PostgreSQL DB)

If you are deploying the container to an existing external PostgreSQL database (e.g. AWS RDS, DigitalOcean Managed DB, or on-premise server):

```bash
# 1. Build the Docker Image
docker build -t sankara-events:latest .

# 2. Run the Container
docker run -d \
  --name sankara-events \
  --restart unless-stopped \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e DATABASE_URL="postgresql://username:password@your-db-host:5432/events_db" \
  -e SESSION_SECRET="your-strong-production-session-secret" \
  -v $(pwd)/uploads:/app/uploads \
  sankara-events:latest
```

---

## 3. Automatic Production Migrations & Vision 2020 Data Backfill

When the container starts up:
1. **Schema Check**: Safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is automatically run on startup.
2. **Legacy Data Attachment**: Any existing unlinked records from the old Vision 2020 production database are automatically attached to the primary Vision 2020 event with zero manual SQL commands needed.
3. **Persistent Uploads**: The `/app/uploads` volume preserves all event brochures, uploaded presentation slides, and photo gallery archives across container restarts.

---

## 4. Nginx Reverse Proxy Configuration (HTTPS)

```nginx
server {
    server_name events.sankaraeye.in;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```
