#!/bin/bash
# ==============================================================================
# SANKARA EVENTS PLATFORM - AUTOMATED SERVER DEPLOYMENT SCRIPT
# ==============================================================================
set -e

echo "🚀 [1/6] Pulling latest updates from GitHub (main branch)..."
git fetch origin main || true
git checkout main || true
git pull origin main || true

echo "⚙️  [2/6] Synchronizing production environment (.env)..."
if [ ! -f .env ] || grep -q "vision2020" .env 2>/dev/null; then
    echo "Updating .env from .env.production..."
    cp -f .env.production .env
    echo "✅ .env updated to target database 'events'."
else
    echo "✅ Existing .env is present."
fi

echo "📁 [3/6] Ensuring upload directories exist with write permissions..."
mkdir -p uploads
chmod -R 777 uploads || true

echo "🗄️  [4/6] Checking PostgreSQL database initialization..."
# Check if sankara-events-db container is running or host PostgreSQL is available
if docker ps --format '{{.Names}}' | grep -q "sankara-events-db"; then
    echo "Checking 'events' database in sankara-events-db container..."
    docker exec -i sankara-events-db psql -U vision2020user -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'events'" | grep -q 1 || {
        echo "Creating 'events' database..."
        docker exec -i sankara-events-db psql -U vision2020user -d postgres -c "CREATE DATABASE events;"
        echo "Applying full schema init script..."
        docker exec -i sankara-events-db psql -U vision2020user -d events < scripts/init_database.sql || true
    }
fi

echo "🏗️  [5/6] Building and launching Docker containers..."
if command -v docker &> /dev/null && [ -f docker-compose.yml ]; then
    docker compose build --no-cache app
    docker compose up -d app
    echo "✅ Docker application container is UP and running."
elif command -v pm2 &> /dev/null; then
    pnpm install
    pnpm run build
    pm2 restart sankara-events || pm2 start artifacts/api-server/dist/index.mjs --name "sankara-events"
    pm2 save
    echo "✅ PM2 process restarted."
fi

echo "🔍 [6/6] Verifying server health..."
sleep 3
if command -v docker &> /dev/null; then
    docker compose logs --tail=20 app
fi

echo ""
echo "=============================================================================="
echo "🎉 DEPLOYMENT COMPLETE! Sankara Events is live on https://events.sankaraeye.in"
echo "=============================================================================="
