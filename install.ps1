# 🦞 ClawConnect Windows "Magic" Installer
# This script ensures Node.js, OpenClaw, and Tailscale are installed and configured.

$ErrorActionPreference = "Stop"

# Colors
$GREEN = "`e[32m"
$CYAN = "`e[36m"
$YELLOW = "`e[33m"
$RED = "`e[31m"
$BOLD = "`e[1m"
$NC = "`e[0m"

Write-Host -ForegroundColor Cyan "`n🦞 ClawConnect Windows Setup"
Write-Host -ForegroundColor Gray "----------------------------------------"

function Has-Command ($cmd) {
    Get-Command $cmd -ErrorAction SilentlyContinue
}

# 1. Node.js
if (-not (Has-Command "node")) {
    Write-Host -ForegroundColor Yellow "Installing Node.js via Winget..."
    winget install -e --id OpenJS.NodeJS
} else {
    Write-Host -ForegroundColor Green "✔ Node.js found"
}

# 2. OpenClaw
if (-not (Has-Command "openclaw")) {
    Write-Host -ForegroundColor Yellow "Installing OpenClaw Gateway..."
    npm install -g @openclaw/gateway
} else {
    Write-Host -ForegroundColor Green "✔ OpenClaw found"
}

# 3. Tailscale
if (-not (Has-Command "tailscale")) {
    Write-Host -ForegroundColor Yellow "Installing Tailscale via Winget..."
    winget install -e --id Tailscale.Tailscale
    Write-Host -ForegroundColor Yellow "Please log in to Tailscale when it opens."
} else {
    Write-Host -ForegroundColor Green "✔ Tailscale found"
}

# 4. Configuration & Auth (using onboard.js)
Write-Host ""
Write-Host -ForegroundColor Cyan "`nPhase 2: Configuration"

if (-not (Test-Path "./onboard.js")) {
    Write-Host -ForegroundColor Gray "Downloading onboarding logic..."
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/publichomepage/claw-connect/main/onboard.js" -OutFile "./onboard.js"
}

# Run the onboarding logic (CORS + Gateway Funnel)
node onboard.js

# Start Screen Share Proxy in background
Write-Host -ForegroundColor Gray "Starting Screen Share Proxy in background..."
Start-Process -FilePath "node" -ArgumentList "onboard.js", "--proxy" -WindowStyle Hidden

Write-Host ""
Write-Host -ForegroundColor Green "`n✨ Ready!"
Write-Host -ForegroundColor Gray "----------------------------------------"
Write-Host "ClawConnect is now running in the background:"
Write-Host "1. Gateway Status:  openclaw gateway status"
Write-Host "2. Funnel Status:   tailscale funnel status"
Write-Host "3. Connect at:      https://claw.publichome.page"
Write-Host -ForegroundColor Gray "----------------------------------------"
Write-Host ""
