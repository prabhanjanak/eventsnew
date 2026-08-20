#!/bin/bash

# ============================================================
#  Vision2020 Conference App — macOS/Linux Startup Script
#  Run this to start both servers on your local WiFi
# ============================================================

# Get WiFi IP automatically (en0 is typically Wi-Fi on macOS)
WIFI_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$WIFI_IP" ]; then
  # Fallback to local network IP
  WIFI_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
fi
if [ -z "$WIFI_IP" ]; then
  WIFI_IP="localhost"
fi

echo ""
echo -e "\033[0;36m============================================\033[0m"
echo -e "\033[0;36m  Vision2020 Conference App (macOS/Linux)\033[0m"
echo -e "\033[0;36m============================================\033[0m"
echo ""
echo -e "\033[0;33m  Starting API Server  (port 5000)...\033[0m"
echo -e "\033[0;33m  Starting Frontend    (port 3000)...\033[0m"
echo ""
echo -e "\033[0;32m  Access on THIS MAC:\033[0m"
echo -e "    http://localhost:3000"
echo ""
echo -e "\033[0;32m  Access on WiFi (other devices):\033[0m"
echo -e "    http://${WIFI_IP}:3000"
echo ""
echo -e "\033[0;90m  Keep this terminal window open to keep servers running.\033[0m"
echo -e "\033[0;90m  Press Ctrl+C to stop everything.\033[0m"
echo -e "\033[0;36m============================================\033[0m"
echo ""

# Function to clean up background processes on exit
cleanup() {
  echo ""
  echo -e "\033[0;31m  Shutting down servers...\033[0m"
  # Kill background jobs
  kill $(jobs -p) 2>/dev/null
  echo -e "\033[0;90m  Done.\033[0m"
  exit
}

trap cleanup SIGINT SIGTERM EXIT

# Start API server in the background
cd artifacts/api-server
pnpm run dev &
API_PID=$!
cd ../..

# Wait a moment for the API server to initialize
sleep 3

# Start Frontend in the background
cd artifacts/vision2020
pnpm run dev &
FRONT_PID=$!
cd ../..

# Monitor processes and auto-restart if crashed
while true; do
  sleep 10
  
  if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "\033[0;31m  [!] API Server stopped - restarting...\033[0m"
    cd artifacts/api-server
    pnpm run dev &
    API_PID=$!
    cd ../..
  fi

  if ! kill -0 $FRONT_PID 2>/dev/null; then
    echo -e "\033[0;31m  [!] Frontend stopped - restarting...\033[0m"
    cd artifacts/vision2020
    pnpm run dev &
    FRONT_PID=$!
    cd ../..
  fi
done
