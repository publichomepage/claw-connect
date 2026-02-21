#!/bin/bash

# 🦞 ClawConnect macOS "Magic" Installer
# This script ensures Node.js, OpenClaw, and Tailscale are installed and configured.

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}🦞 ClawConnect macOS Setup${NC}"
echo -e "${DIM}----------------------------------------${NC}"

# Function to check command
has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Homebrew
if ! has_cmd brew; then
    echo -e "${YELLOW}Installing Homebrew (macOS package manager)...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to path for the rest of the script
    eval "$(/opt/homebrew/bin/brew shellenv)" || eval "$(/usr/local/bin/brew shellenv)"
else
    echo -e "${GREEN}✔ Homebrew found${NC}"
fi

# 2. Node.js
if ! has_cmd node; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    brew install node
else
    echo -e "${GREEN}✔ Node.js found${NC}"
fi

# 3. OpenClaw
if ! has_cmd openclaw; then
    echo -e "${YELLOW}Installing OpenClaw Gateway...${NC}"
    npm i -g openclaw
else
    echo -e "${GREEN}✔ OpenClaw found${NC}"
fi

# 4. Tailscale
if ! has_cmd tailscale; then
    echo -e "${YELLOW}Installing Tailscale...${NC}"
    brew install --cask tailscale
    echo -e "${YELLOW}Please open Tailscale from your Applications and Log In.${NC}"
    open /Applications/Tailscale.app
else
    echo -e "${GREEN}✔ Tailscale found${NC}"
fi

# 5. Configuration & Auth (using onboard.js logic)
echo ""
echo -e "${CYAN}${BOLD}Phase 2: Configuration${NC}"

if [ ! -f "./onboard.js" ]; then
    echo -e "${DIM}Downloading onboarding logic...${NC}"
    curl -sLO https://raw.githubusercontent.com/publichomepage/claw-connect/main/onboard.js
fi

# Run the onboarding logic (Quietly)
node onboard.js --quiet

# Start Screen Share Proxy in background (Idempotent)
echo -e "${DIM}Configuring background services...${NC}"
pkill -f "onboard.js --proxy" || true
node onboard.js --proxy > /dev/null 2>&1 &

# Brief pause to let background funnels initialize
sleep 2

echo ""
echo -e "${GREEN}${BOLD}✨ ClawConnect Is Ready!${NC}"
echo -e "${DIM}----------------------------------------${NC}"
node onboard.js --status
echo -e "${DIM}----------------------------------------${NC}"
echo -e "${YELLOW}Tip: Use 'tailscale funnel status' to check domains manually.${NC}"
echo ""
