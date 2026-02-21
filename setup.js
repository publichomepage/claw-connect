#!/usr/bin/env node

/**
 * ClawConnect Setup Script
 *
 * Automatically configures your environment for ClawConnect.
 * Run with: npm run setup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const BACKUP_PATH = CONFIG_PATH + '.bak';
const CLAWCONNECT_ORIGIN = 'https://claw.publichome.page';
const LOCALHOST_ORIGIN = 'http://localhost:4200';
const DRY_RUN = process.argv.includes('--dry-run');

// Colors for terminal output
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(msg) { console.log(msg); }
function success(msg) { log(`${GREEN}✔${RESET} ${msg}`); }
function warn(msg) { log(`${YELLOW}⚠${RESET} ${msg}`); }
function error(msg) { log(`${RED}✘${RESET} ${msg}`); }
function info(msg) { log(`${CYAN}ℹ${RESET} ${msg}`); }

function checkCommand(cmd) {
    try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

log('');
log(`${BOLD}🦞 ClawConnect Setup${RESET}`);
log(`${DIM}${'─'.repeat(40)}${RESET}`);
if (DRY_RUN) {
    log(`${YELLOW}${BOLD}DRY RUN MODE ENABLED${RESET}`);
    log(`${DIM}No changes will be written, and sensitive data will be masked.${RESET}`);
}
log('');

// --- 1. System Requirements ---
log(`${BOLD}Phase 1: Checking System Requirements${RESET}`);

const hasOpenClaw = checkCommand('openclaw');
const hasTailscale = checkCommand('tailscale');

if (hasOpenClaw) {
    success('OpenClaw CLI found');
} else {
    warn('OpenClaw CLI not found in PATH');
    info('To install: npm install -g @openclaw/gateway');
}

if (hasTailscale) {
    success('Tailscale found');
} else {
    error('Tailscale not found');
    info('Tailscale is required for secure remote access.');
    info('Download it here: https://tailscale.com/download');
    log('');
}

// --- 2. Gateway Configuration (CORS) ---
log(`${BOLD}Phase 2: Configuring Gateway CORS${RESET}`);

if (!fs.existsSync(CONFIG_PATH)) {
    warn(`OpenClaw config not found at ${CONFIG_PATH}`);
    info('Please run "openclaw onboard" or start OpenClaw first.');
} else {
    let rawConfig;
    let config;
    try {
        rawConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
        config = JSON.parse(rawConfig);

        // Backup
        fs.writeFileSync(BACKUP_PATH, rawConfig, 'utf-8');
        success(`Backed up config to ${DIM}${BACKUP_PATH}${RESET}`);

        let changed = false;
        if (!config.gateway) config.gateway = {};
        if (!config.gateway.controlUi) config.gateway.controlUi = {};
        if (!config.gateway.controlUi.allowedOrigins) config.gateway.controlUi.allowedOrigins = [];

        const origins = config.gateway.controlUi.allowedOrigins;
        if (!origins.includes(CLAWCONNECT_ORIGIN)) {
            origins.push(CLAWCONNECT_ORIGIN);
            success(`Added ${CYAN}${CLAWCONNECT_ORIGIN}${RESET} to allowedOrigins`);
            changed = true;
        }

        if (config.gateway.controlUi.allowInsecureAuth !== true) {
            config.gateway.controlUi.allowInsecureAuth = true;
            success('Enabled allowInsecureAuth');
            changed = true;
        }

        if (changed) {
            if (DRY_RUN) {
                info(`[DRY RUN] Would update ${CONFIG_PATH}`);
            } else {
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
                success(`Updated ${DIM}${CONFIG_PATH}${RESET}`);
            }
        } else {
            success('Gateway configuration is already up to date');
            info(`Allowed origins: ${DIM}${origins.join(', ')}${RESET}`);
        }

        if (config.gateway?.auth?.token) {
            const token = config.gateway.auth.token;
            log('');
            if (DRY_RUN) {
                const masked = '•'.repeat(24) + token.slice(-4);
                info(`Your auth token: ${GREEN}${BOLD}${masked}${RESET} (masked for dry-run)`);
            } else {
                info(`Your auth token: ${GREEN}${BOLD}${token}${RESET} (copy this into ClawConnect)`);
            }
        }
    } catch (err) {
        error(`Failed to update config: ${err.message}`);
    }
}

// --- 3. Running Prerequisites ---
log('');
log(`${BOLD}Phase 3: Service Status${RESET}`);

if (hasOpenClaw) {
    try {
        const status = execSync('openclaw gateway status', { encoding: 'utf-8' });
        if (status.includes('Runtime: running')) {
            success('OpenClaw Gateway is running (active)');
        } else {
            warn('OpenClaw Gateway is not running');
            info(`Please ensure your OpenClaw Gateway is active before connecting.`);
        }
    } catch (e) {
        warn('Could not determine OpenClaw Gateway status');
    }
}

// --- Summary ---
log('');
log(`${BOLD}${GREEN}Setup Checklist Summary${RESET}`);
log(`${DIM}${'─'.repeat(40)}${RESET}`);
log(`1. [${hasOpenClaw ? 'X' : ' '}] Install OpenClaw CLI`);
log(`2. [${hasTailscale ? 'X' : ' '}] Install Tailscale`);
log(`3. [X] Configure CORS & Auth`);
log(`4. [ ] Ensure OpenClaw Gateway is running (check: ${BOLD}openclaw gateway status${RESET})`);
log(`5. [ ] Run: ${CYAN}tailscale funnel --https=8443 http://localhost:18789${RESET}`);
log(`6. [ ] For Screen Share: Run ${CYAN}node ws-proxy.js 6080 localhost:5900${RESET}`);
log(`7. [ ] For Screen Share: Run ${CYAN}tailscale funnel 6080${RESET} (this exposes it on ${BOLD}port 443${RESET})`);
log('');
info(`Tip: After starting a funnel, Tailscale will show your public domain`);
info(`(e.g., ${BOLD}your-mac.tailnet-abc.ts.net${RESET}). Use this in ClawConnect!`);
log('');
log(`${BOLD}Ready!${RESET} Open ${CYAN}https://claw.publichome.page${RESET} to connect.`);
log('');
