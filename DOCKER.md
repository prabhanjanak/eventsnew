# Docker Production Deployment Guide: Sankara Events Platform

This guide provides end-to-end instructions for the server administrator to deploy, run, update, and maintain the **Sankara Events Platform** using Docker & Docker Compose.

---

## 📋 System Requirements
- **OS**: Ubuntu 22.04 LTS / Debian 12 / RHEL 9 (or any modern Linux distro)
- **CPU / RAM**: 2+ vCPUs, 4GB+ RAM recommended
- **Disk**: 20GB+ SSD storage
- **Docker**: Docker Engine 24+ & Docker Compose v2+

---

## 🚀 1. Initial Server Setup & Deployment

### Step 1: Clone the Repository
```bash
# Clone the repository onto the server
git clone https://github.com/prabhanjanak/eventsnew.git /opt/sankara-events
cd /opt/sankara-events
```

### Step 2: Configure Production Environment (`.env`)
```bash
# Copy template configuration
cp .env.example .env

# Edit .env with your production credentials
nano .env
```

Ensure you set:
- `SESSION_SECRET`: A secure 32+ character random string (generate with `openssl rand -base64 32`)
- `POSTGRES_PASSWORD`: A strong password for the PostgreSQL container
- `SERVER_BASE_URL` & `FRONTEND_URL`: Your production domain (e.g. `https://events.sankaraeye.in`)
- `SMTP_USER` & `SMTP_PASS`: Zoho / Google Workspace SMTP credentials
*(Note: Razorpay payment gateway credentials are configured directly in the Admin UI and stored in the database)*

---

### Step 3: Build & Start Containers
```bash
# Build images and start application & database in background
docker compose up -d --build

# Verify container status
docker compose ps
```

### Step 4: Verify Application Health
```bash
# View live logs
docker compose logs -f app

# Test health check endpoint
curl -I http://127.0.0.1:5000/api/health
```

The application is now running on port **`5000`** with PostgreSQL on port **`5432`** (bound to `127.0.0.1`).

---

## 🔄 2. Day-to-Day Administration Commands

### Check Service Status & Resource Usage
```bash
# Check container status
docker compose ps

# Check real-time CPU & memory consumption
docker stats sankara-events-app sankara-events-db
```

### View Live Logs
```bash
# View app server logs (tail last 100 lines)
docker compose logs -f --tail=100 app

# View database logs
docker compose logs -f --tail=100 db
```

### Restart / Stop Services
```bash
# Restart application container only (quick restart)
docker compose restart app

# Restart entire stack
docker compose restart

# Stop all containers (data in PostgreSQL and /uploads remains safe)
docker compose down
```

---

## 🔄 3. Updating to Latest Code (Zero-Downtime / Fast Update)

When code changes are pushed to GitHub, run:

```bash
cd /opt/sankara-events

# Pull latest commits
git pull origin main

# Rebuild and restart app container with minimal downtime
docker compose up -d --build app

# Check logs to confirm successful startup
docker compose logs -f --tail=50 app
```

---

## 💾 4. Database Backup & Restore

### Create an Automated Database Backup (.sql)
```bash
# Create backup directory
mkdir -p /opt/backups/db

# Dump database to compressed sql file
docker compose exec -t db pg_dump -U postgres events_db | gzip > /opt/backups/db/events_db_$(date +%F_%H%M%S).sql.gz

echo "Backup created in /opt/backups/db/"
```

### Restore Database from SQL Backup
```bash
# Uncompress and import backup
gunzip -c /opt/backups/db/events_db_2026-08-21.sql.gz | docker compose exec -T db psql -U postgres -d events_db
```

### Backup Uploaded Files (/uploads)
```bash
# Backup uploads folder (photos, brochures, badges)
tar -czf /opt/backups/uploads_$(date +%F).tar.gz uploads/
```

---

## 🔒 5. Production Nginx Reverse Proxy & SSL (HTTPS)

### Step 1: Install Nginx & Certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step 2: Configure Nginx Site (`/etc/nginx/sites-available/events.sankaraeye.in`)
```nginx
server {
    server_name events.sankaraeye.in;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }
}
```

```bash
# Enable site configuration and reload Nginx
sudo ln -sf /etc/nginx/sites-available/events.sankaraeye.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 3: Obtain Free Let's Encrypt SSL Certificate
```bash
sudo certbot --nginx -d events.sankaraeye.in
```

---

## 🛡️ 6. Firewall Configuration (UFW)
```bash
# Allow SSH, HTTP, and HTTPS only (Postgres stays internal)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 🆘 Troubleshooting Quick Reference

| Issue | Diagnostic Command | Solution |
|---|---|---|
| **App won't start** | `docker compose logs app` | Check for invalid `SESSION_SECRET` or DB connection error in `.env`. |
| **DB connection failed** | `docker compose exec db pg_isready` | Ensure `POSTGRES_PASSWORD` in `.env` matches `DATABASE_URL`. |
| **File upload fails** | `ls -ld uploads` | Run `sudo chown -R 1001:1001 uploads/` to ensure container write permissions. |
| **Port 5000 in use** | `sudo lsof -i :5000` | Stop conflicting process or change host port in `docker-compose.yml` (e.g. `5001:5000`). |

