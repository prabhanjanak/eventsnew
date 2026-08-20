#!/bin/bash
# ==============================================================================
# SANKARA EVENTS PLATFORM - SERVER DEPLOYMENT SCRIPT
# For Server Administrators: Pull latest code, install, build, and restart
# ==============================================================================

set -e

echo "🚀 [1/5] Pulling latest updates from GitHub..."
git fetch origin main || git fetch origin 1.0.4mac || true
git pull origin main || git pull origin 1.0.4mac || true

echo "📦 [2/5] Installing dependencies with pnpm..."
corepack enable
pnpm install --frozen-lockfile || pnpm install

echo "🏗️ [3/5] Building all packages & frontend SPA..."
pnpm run build

echo "📁 [4/5] Ensuring uploads directory exists..."
mkdir -p uploads

echo "🔄 [5/5] Restarting production services..."
# If using Docker:
if command -v docker &> /dev/null && [ -f docker-compose.yml ]; then
    echo "Restarting via Docker Compose..."
    docker compose down && docker compose up -d --build
    echo "✅ Docker deployment completed successfully!"
# If using PM2:
elif command -v pm2 &> /dev/null; then
    echo "Restarting via PM2..."
    pm2 restart sankara-events || pm2 start artifacts/api-server/dist/index.mjs --name "sankara-events"
    pm2 save
    echo "✅ PM2 deployment completed successfully!"
# If using Systemd:
elif systemctl is-active --quiet sankara-events; then
    echo "Restarting systemd service..."
    sudo systemctl restart sankara-events
    echo "✅ Systemd service restarted successfully!"
else
    echo "✅ Build completed. Run 'node artifacts/api-server/dist/index.mjs' or start your process manager."
fi

echo "🎉 Deployment finished! Production server is live."
