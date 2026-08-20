
# ============================================================
#  Vision2020 Conference App — Startup Script
#  Run this to start both servers on your local WiFi
# ============================================================

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir      = Join-Path $ProjectRoot "artifacts\api-server"
$FrontDir    = Join-Path $ProjectRoot "artifacts\vision2020"

# Get WiFi IP automatically
$WifiIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" -or $_.InterfaceAlias -like "*WiFi*" -or $_.InterfaceAlias -like "*Wireless*" } |
    Select-Object -First 1).IPAddress

if (-not $WifiIP) {
    $WifiIP = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
        Select-Object -First 1).IPAddress
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Vision2020 Conference App" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Starting API Server  (port 5000)..." -ForegroundColor Yellow
Write-Host "  Starting Frontend    (port 3000)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Access on THIS PC:" -ForegroundColor Green
Write-Host "    http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Access on WiFi (other devices):" -ForegroundColor Green
Write-Host "    http://${WifiIP}:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Keep this window open to keep servers running." -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Start API server in a new window
$ApiJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ApiDir'; Write-Host '[API SERVER] Starting on port 5000...' -ForegroundColor Yellow; pnpm run start"
) -PassThru

# Wait a moment for the API server to initialize
Start-Sleep -Seconds 3

# Start Frontend in a new window
$FrontJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$FrontDir'; Write-Host '[FRONTEND] Starting on port 3000...' -ForegroundColor Yellow; pnpm run dev"
) -PassThru

Write-Host "  Both servers launched in separate windows." -ForegroundColor Green
Write-Host "  Monitoring... (close this window to stop both)" -ForegroundColor Gray
Write-Host ""

# Keep this window alive and monitor both processes
try {
    while ($true) {
        Start-Sleep -Seconds 10

        # Auto-restart API if crashed
        if ($ApiJob.HasExited) {
            Write-Host "  [!] API Server stopped - restarting..." -ForegroundColor Red
            $ApiJob = Start-Process powershell -ArgumentList @(
                "-NoExit",
                "-Command",
                "cd '$ApiDir'; pnpm run start"
            ) -PassThru
        }

        # Auto-restart Frontend if crashed
        if ($FrontJob.HasExited) {
            Write-Host "  [!] Frontend stopped - restarting..." -ForegroundColor Red
            $FrontJob = Start-Process powershell -ArgumentList @(
                "-NoExit",
                "-Command",
                "cd '$FrontDir'; pnpm run dev"
            ) -PassThru
        }
    }
} finally {
    Write-Host ""
    Write-Host "  Shutting down servers..." -ForegroundColor Red
    if (-not $ApiJob.HasExited)   { Stop-Process -Id $ApiJob.Id   -Force -ErrorAction SilentlyContinue }
    if (-not $FrontJob.HasExited) { Stop-Process -Id $FrontJob.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "  Done." -ForegroundColor Gray
}
