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
const START_PROXY = process.argv.includes('--proxy') || process.argv.includes('--all');

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

/**
 * Embedded WebSocket Proxy Logic
 * (Allows setup.js to run as a standalone service via npx)
 */
function runProxy(wsPort = 6080, vncTarget = 'localhost:5900') {
    const net = require('net');
    let WebSocketServer;
    try {
        ({ WebSocketServer } = require('ws'));
    } catch (e) {
        error('The "ws" package is required for the proxy.');
        info('Please run: npm install -g ws');
        process.exit(1);
    }

    const [vncHost, vncPortStr] = vncTarget.split(':');
    const vncPort = parseInt(vncPortStr || '5900');

    const wss = new WebSocketServer({
        port: wsPort,
        handleProtocols: (protocols) => {
            if (protocols.has('binary')) return 'binary';
            return false;
        }
    });

    log(`${DIM}${'─'.repeat(40)}${RESET}`);
    log(`${BOLD}🚀 Screen Share Proxy Started${RESET}`);
    info(`Listening on ${BOLD}ws://localhost:${wsPort}${RESET} → ${vncHost}:${vncPort}`);
    info('Keep this terminal open while using Screen Share.');
    log(`${DIM}${'─'.repeat(40)}${RESET}`);

    wss.on('connection', (ws, req) => {
        const vnc = net.connect(vncPort, vncHost);
        let vncConnected = false;

        vnc.on('connect', () => { vncConnected = true; });
        vnc.on('data', (data) => { if (ws.readyState === 1) ws.send(data); });
        vnc.on('end', () => ws.close());
        vnc.on('error', () => ws.close());

        ws.on('message', (data) => { if (vncConnected && !vnc.destroyed) vnc.write(data); });
        ws.on('close', () => vnc.end());
        ws.on('error', () => vnc.end());
    });
}

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

// --- 1. System Requirements ---
log(`${BOLD}Phase 1: Checking System Requirements${RESET}`);

const hasOpenClaw = checkCommand('openclaw');
const hasTailscale = checkCommand('tailscale');

if (hasOpenClaw) {
    success('OpenClaw CLI found');
} else {
    warn('OpenClaw CLI not found in PATH');
}

if (hasTailscale) {
    success('Tailscale found');
} else {
    error('Tailscale not found (required for remote access)');
}

// --- 2. Gateway Configuration (CORS) ---
log('');
log(`${BOLD}Phase 2: Configuring Gateway CORS${RESET}`);

if (!fs.existsSync(CONFIG_PATH)) {
    warn(`OpenClaw config not found at ${CONFIG_PATH}`);
} else {
    try {
        const rawConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(rawConfig);

        if (!DRY_RUN) fs.writeFileSync(BACKUP_PATH, rawConfig, 'utf-8');

        let changed = false;
        if (!config.gateway) config.gateway = {};
        if (!config.gateway.controlUi) config.gateway.controlUi = {};
        if (!config.gateway.controlUi.allowedOrigins) config.gateway.controlUi.allowedOrigins = [];

        const origins = config.gateway.controlUi.allowedOrigins;
        if (!origins.includes(CLAWCONNECT_ORIGIN)) {
            origins.push(CLAWCONNECT_ORIGIN);
            changed = true;
        }
        if (config.gateway.controlUi.allowInsecureAuth !== true) {
            config.gateway.controlUi.allowInsecureAuth = true;
            changed = true;
        }

        if (changed) {
            if (DRY_RUN) {
                success(`[DRY RUN] Would update config to allow ${CLAWCONNECT_ORIGIN}`);
            } else {
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
                success(`Updated Gateway CORS to allow ${BOLD}${CLAWCONNECT_ORIGIN}${RESET}`);
            }
        } else {
            success('Gateway configuration is already up to date');
        }

        if (config.gateway?.auth?.token) {
            const token = config.gateway.auth.token;
            if (DRY_RUN) {
                const masked = '•'.repeat(24) + token.slice(-4);
                info(`Your auth token: ${GREEN}${BOLD}${masked}${RESET}`);
            } else {
                info(`Your auth token: ${GREEN}${BOLD}${token}${RESET} (copy this)`);
            }
        }
    } catch (err) {
        error(`Failed to update config: ${err.message}`);
    }
}

// --- 3. Summary or Proxy Start ---
if (START_PROXY) {
    runProxy();
} else {
    log('');
    log(`${BOLD}${GREEN}Setup Checklist Summary${RESET}`);
    log(`${DIM}${'─'.repeat(40)}${RESET}`);
    log(`1. [${hasOpenClaw ? 'X' : ' '}] OpenClaw CLI`);
    log(`2. [${hasTailscale ? 'X' : ' '}] Tailscale`);
    log(`3. [X] Configure CORS & Auth`);
    log(`4. [ ] Run Screen Proxy: ${CYAN}npx claw-connect-setup --proxy${RESET}`);
    log(`5. [ ] Run Funnel: ${CYAN}tailscale funnel --https=8443 http://localhost:18789${RESET}`);
    log('');
    info(`Tip: Use ${BOLD}--proxy${RESET} to start the screen share proxy immediately.`);
    log('');
}

