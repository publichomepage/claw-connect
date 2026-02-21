#!/usr/bin/env node

/**
 * ClawConnect Onboarding Script
 * 
 * Automatically configures your Mac for ClawConnect and (optionally) starts 
 * the Screen Share proxy.
 * 
 * Usage:
 *   npx -y claw-connect-setup          (Just configuration)
 *   npx -y claw-connect-setup --proxy  (Configure + Start Screen Share Proxy)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const CLAWCONNECT_ORIGIN = 'https://claw.publichome.page';
const DRY_RUN = process.argv.includes('--dry-run');
const START_PROXY = process.argv.includes('--proxy') || process.argv.includes('--all');
const SHOW_STATUS = process.argv.includes('--status');
const QUIET = process.argv.includes('--quiet');

// Colors
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

/**
 * WebSocket-to-TCP Proxy Logic
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
        handleProtocols: (protocols) => (protocols.has('binary') ? 'binary' : false)
    });

    log(`${DIM}${'─'.repeat(40)}${RESET}`);
    log(`${BOLD}🚀 Screen Share Proxy Starting${RESET}`);
    info(`Listening on ${BOLD}ws://localhost:${wsPort}${RESET} → ${vncHost}:${vncPort}`);
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

    // Automate Funnel for Screen Share
    setupFunnel(wsPort, wsPort);
}

/**
 * Automate Tailscale Funnel
 */
function setupFunnel(localPort, publicPort = null) {
    if (!checkCommand('tailscale')) return;

    try {
        log(`${DIM}Configuring Tailscale Funnel for port ${localPort} (Background)...${RESET}`);
        // For screen share (6080) we want raw TCP funnel usually, but --http=6080 6080 works best for web components
        const cmd = publicPort === 6080
            ? `tailscale funnel --bg --http=6080 6080`
            : `tailscale funnel --bg --https=8443 http://localhost:18789`;

        // Run as async-style background so it doesn't block the script if it stays open, 
        // but here we just want to ensure it's "set".
        // Use spawn with detached for non-blocking if needed, but for 'setting' it might just return.
        execSync(cmd, { stdio: 'inherit', timeout: 5000 });
        success(`Tailscale Funnel configured for port ${localPort}`);
    } catch (e) {
        warn(`Could not automatically start Funnel for ${localPort}. You may need to run it manually.`);
        info(`Manual command: ${CYAN}tailscale funnel ${localPort}${RESET}`);
    }
}

if (!QUIET && !SHOW_STATUS) {
    log('');
    log(`${BOLD}🦞 ClawConnect Onboarding${RESET}`);
    log(`${DIM}${'─'.repeat(40)}${RESET}`);
}

// --- 1. Requirements ---
if (!QUIET && !SHOW_STATUS) log(`${BOLD}Phase 1: Requirements${RESET}`);
const hasOpenClaw = checkCommand('openclaw');
const hasTailscale = checkCommand('tailscale');

if (hasOpenClaw) success('OpenClaw CLI found');
else warn('OpenClaw CLI not found');

if (hasTailscale) success('Tailscale found');
else error('Tailscale not found (required for remote access)');

// --- 2. Gateway CORS ---
if (!QUIET && !SHOW_STATUS) {
    log('');
    log(`${BOLD}Phase 2: Gateway Configuration${RESET}`);
}

if (!fs.existsSync(CONFIG_PATH)) {
    warn(`OpenClaw config not found at ${CONFIG_PATH}`);
} else {
    try {
        const rawConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(rawConfig);
        let changed = false;

        if (!config.gateway) config.gateway = {};
        if (!config.gateway.controlUi) config.gateway.controlUi = {};
        if (!config.gateway.controlUi.allowedOrigins) config.gateway.controlUi.allowedOrigins = [];

        if (!config.gateway.controlUi.allowedOrigins.includes(CLAWCONNECT_ORIGIN)) {
            config.gateway.controlUi.allowedOrigins.push(CLAWCONNECT_ORIGIN);
            changed = true;
        }
        if (config.gateway.controlUi.allowInsecureAuth !== true) {
            config.gateway.controlUi.allowInsecureAuth = true;
            changed = true;
        }

        if (changed) {
            if (!DRY_RUN) fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
            success(`Updated Gateway CORS to allow ${BOLD}${CLAWCONNECT_ORIGIN}${RESET}`);
        } else {
            success('Gateway configuration is already up to date');
        }

        if (config.gateway?.auth?.token) {
            const token = config.gateway.auth.token;
            info(`Your auth token: ${GREEN}${BOLD}${token}${RESET} (copy this)`);
        }

        // Automate Gateway Funnel (always try to ensure it's set up)
        if (!DRY_RUN) setupFunnel(18789);
    } catch (err) {
        error(`Failed to update config: ${err.message}`);
    }
}

/**
 * Print Live Status Summary
 */
function printStatus() {
    log(`${BOLD}🦞 ClawConnect Live Status${RESET}`);
    log(`${DIM}${'─'.repeat(40)}${RESET}`);

    // 1. Gateway
    try {
        const status = execSync('openclaw gateway status', { encoding: 'utf-8' });
        if (status.includes('running') || status.includes('ONLINE')) {
            success(`Gateway: ${GREEN}${BOLD}ONLINE${RESET}`);
        } else {
            warn(`Gateway: ${YELLOW}NOT RUNNING${RESET}`);
        }
    } catch (e) {
        error(`Gateway: ${RED}FAILED TO CHECK${RESET}`);
    }

    // 2. Funnels
    try {
        const funnel = execSync('tailscale funnel status', { encoding: 'utf-8' });
        const hasGateway = funnel.includes('18789');
        const hasProxy = funnel.includes('6080');

        if (hasGateway) success(`Chat Funnel: ${GREEN}${BOLD}ACTIVE${RESET} (port 8443)`);
        else warn(`Chat Funnel: ${YELLOW}INACTIVE${RESET}`);

        if (hasProxy) success(`Screen Funnel: ${GREEN}${BOLD}ACTIVE${RESET} (port 443)`);
        else warn(`Screen Funnel: ${YELLOW}INACTIVE${RESET}`);

        if (funnel.includes('.ts.net')) {
            const domain = funnel.match(/[a-z0-9-]+\.[a-z0-9-]+\.ts\.net/i);
            if (domain) info(`Public Domain: ${CYAN}${BOLD}${domain[0]}${RESET}`);
        }
    } catch (e) {
        error(`Funnels: ${RED}OFFLINE${RESET} (Tailscale not running?)`);
    }

    log(`${DIM}${'─'.repeat(40)}${RESET}`);
    log(`Connect at: ${BOLD}${CLAWCONNECT_ORIGIN}${RESET}`);
    log('');
}

// --- 4. Main Actions ---
if (SHOW_STATUS) {
    printStatus();
} else if (START_PROXY) {
    runProxy();
} else if (!QUIET) {
    log('');
    log(`${BOLD}${GREEN}Ready!${RESET}`);
    log(`${DIM}${'─'.repeat(40)}${RESET}`);
    printStatus();
}
