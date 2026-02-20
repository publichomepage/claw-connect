#!/usr/bin/env node
/**
 * WebSocket-to-TCP proxy for VNC (replaces websockify)
 * Uses the `ws` npm package for reliable WebSocket handling.
 * Usage: node ws-proxy.js [ws-port] [vnc-host:vnc-port]
 */

const net = require('net');
const { WebSocketServer } = require('ws');

const WS_PORT = parseInt(process.argv[2] || '6080');
const VNC_TARGET = process.argv[3] || 'localhost:5900';
const [VNC_HOST, VNC_PORT_STR] = VNC_TARGET.split(':');
const VNC_PORT_NUM = parseInt(VNC_PORT_STR);

const wss = new WebSocketServer({
    port: WS_PORT,
    handleProtocols: (protocols) => {
        // Accept 'binary' subprotocol if requested (noVNC needs this)
        if (protocols.has('binary')) return 'binary';
        return false;
    }
});

console.log(`[ws-proxy] Listening on :${WS_PORT} → ${VNC_HOST}:${VNC_PORT_NUM}`);

wss.on('connection', (ws, req) => {
    console.log(`[ws-proxy] WebSocket connected from ${req.socket.remoteAddress}`);

    const vnc = net.connect(VNC_PORT_NUM, VNC_HOST);
    let vncConnected = false;

    vnc.on('connect', () => {
        vncConnected = true;
        console.log(`[ws-proxy] TCP connected to VNC at ${VNC_HOST}:${VNC_PORT_NUM}`);
    });

    // VNC → WebSocket (raw TCP data → binary WS frames)
    vnc.on('data', (data) => {
        console.log(`[ws-proxy] VNC → WS: ${data.length} bytes`);
        if (ws.readyState === ws.OPEN) {
            ws.send(data);
        }
    });

    vnc.on('end', () => {
        console.log('[ws-proxy] VNC connection ended');
        ws.close();
    });

    vnc.on('error', (err) => {
        console.error('[ws-proxy] VNC error:', err.message);
        ws.close(1011, 'VNC connection error');
    });

    // WebSocket → VNC (binary WS frames → raw TCP data)
    ws.on('message', (data) => {
        console.log(`[ws-proxy] WS → VNC: ${data.length} bytes`);
        if (vncConnected && !vnc.destroyed) {
            vnc.write(data);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[ws-proxy] WebSocket closed (code: ${code}, reason: ${reason})`);
        vnc.end();
    });

    ws.on('error', (err) => {
        console.error('[ws-proxy] WebSocket error:', err.message);
        vnc.end();
    });
});
