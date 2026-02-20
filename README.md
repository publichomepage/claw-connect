# 🦞 ClawConnect

A premium Angular chat interface for [OpenClaw](https://openclaw.ai) — your personal AI assistant.

ClawConnect connects to the OpenClaw Gateway via WebSocket and provides a sleek, dark-themed chat experience for interacting with your AI assistant.

---

## Screenshots

| Connected Chat | Settings Panel |
|---|---|
| Messages render with full markdown support, streaming indicators, and distinct user/assistant styling | Configure Gateway URL, auth token, and password with localStorage persistence |

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                   ClawConnect App                      │
│                 (Angular 19 SPA)                       │
│                                                        │
│  ┌───────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  ChatComp │  │ MsgComp  │  │  ScreenShareComp   │  │
│  │ (main UI) │  │(messages)│  │   (remote VNC)     │  │
│  └─────┬─────┘  └────┬─────┘  └────────┬───────────┘  │
│        │             │                 │               │
│        └──────┬──────┘                 │               │
│               │                        │               │
│    ┌──────────▼──────────┐   ┌─────────▼───────────┐  │
│    │   OpenClawService   │   │   noVNC (RFB.js)    │  │
│    │ (WS + Protocol v3)  │   │  (ESM from public/) │  │
│    └──────────┬──────────┘   └─────────┬───────────┘  │
└──────────────┼───────────────────────┼────────────────┘
               │ WebSocket             │ WebSocket
               ▼                       ▼
    ┌──────────────────┐    ┌──────────────────────────┐
    │  OpenClaw Gateway │    │  ws-proxy.js (Node.js)   │
    │ (localhost:18789) │    │  WS:6080 → TCP:5900     │
    └──────────────────┘    └───────────┬──────────────┘
                                        │ TCP
                                        ▼
                             ┌────────────────────┐
                             │ macOS Screen Share  │
                             │   (VNC on :5900)   │
                             └────────────────────┘
```

### Project Structure

```
src/app/
├── app.ts                          # Root component
├── app.config.ts                   # Angular configuration
├── components/
│   ├── chat/chat.component.ts      # Main chat container + tab navigation
│   ├── message/message.component.ts# Individual message (user/assistant/system)
│   ├── screen-share/
│   │   └── screen-share.component.ts # Remote VNC screen sharing via noVNC
│   └── settings/settings.component.ts # Connection settings panel
└── services/
    └── openclaw.service.ts         # WebSocket client implementing Gateway Protocol v3

public/novnc/                       # noVNC ESM source (v1.5.0)
├── core/                           # RFB, display, input modules
└── vendor/pako/                    # Compression library

ws-proxy.js                         # Node.js WebSocket-to-TCP proxy for VNC
```

### Key Files

| File | Purpose |
|------|---------|
| `openclaw.service.ts` | Core WebSocket service — handles Gateway Protocol v3 handshake, request/response framing, session management, streaming, history loading, and structured content parsing |
| `chat.component.ts` | Main UI — tab navigation (Chat / Screen Share), message list, input area, connection status |
| `screen-share.component.ts` | Remote VNC viewer — Tailscale config, noVNC integration, Apple ARD auth, toolbar controls |
| `message.component.ts` | Message bubble — role-based styling (user/assistant/system), markdown rendering, timestamps |
| `settings.component.ts` | Config panel — Gateway URL, auth token/password, localStorage persistence |
| `ws-proxy.js` | Node.js WebSocket-to-TCP proxy — bridges browser WebSocket to macOS VNC server |
| `styles.css` | Global premium dark theme — animated gradients, glassmorphism, custom scrollbars |

---

## OpenClaw Gateway Protocol v3

ClawConnect implements the [OpenClaw Gateway](https://docs.openclaw.ai) WebSocket protocol. Here's how the connection works:

### Connection Handshake

```
Client                              Gateway
  │                                    │
  │──── WebSocket connect ────────────►│
  │                                    │
  │◄─── connect.challenge event ──────│  (server sends nonce)
  │                                    │
  │──── connect request ──────────────►│  (client sends auth + client info)
  │     {type:"req",                   │
  │      method:"connect",             │
  │      params:{                      │
  │        minProtocol:3,              │
  │        maxProtocol:3,              │
  │        client:{id,version,mode},   │
  │        auth:{token:"..."},         │
  │        role:"operator",            │
  │        scopes:[...]}}              │
  │                                    │
  │◄─── connect response (hello-ok)───│  (server returns session info)
  │     {type:"res", ok:true,          │
  │      payload:{snapshot:{           │
  │        session:{mainSessionKey}}}} │
  │                                    │
  │──── chat.history request ─────────►│  (client loads history)
  │──── chat.send request ────────────►│  (client sends messages)
  │◄─── chat event ──────────────────│  (server pushes responses)
```

### Frame Format

All frames are JSON objects with a `type` discriminator:

| Type | Direction | Purpose |
|------|-----------|---------|
| `req` | Client → Server | Request: `{type:"req", id, method, params}` |
| `res` | Server → Client | Response: `{type:"res", id, ok, payload/error}` |
| `event` | Server → Client | Push event: `{type:"event", event, payload}` |

### Key Methods

| Method | Required Params | Description |
|--------|----------------|-------------|
| `connect` | `client`, `auth`, `minProtocol`, `maxProtocol` | Handshake — must be the first frame |
| `chat.send` | `sessionKey`, `message`, `idempotencyKey` | Send a user message |
| `chat.history` | `sessionKey` | Retrieve conversation transcript |

### Content Blocks

OpenClaw returns message content as Anthropic/OpenAI-style structured blocks:

```json
{
  "content": [
    {"type": "text", "text": "Hello! Here's what I can help with..."},
    {"type": "tool_use", "name": "read_file", "input": {...}}
  ]
}
```

The `extractContent()` helper in `openclaw.service.ts` recursively extracts readable text from these blocks.

---

## Prerequisites

- **Node.js** ≥ 18
- **OpenClaw** installed and running locally ([Getting Started](https://docs.openclaw.ai/start/getting-started))
- **OpenClaw Gateway** running on `localhost:18789` (default)

---

## Setup

### 1. Install Dependencies

```bash
cd clawcoder
npm install
```

### 2. Configure the Gateway

ClawConnect connects as an `openclaw-control-ui` client, which requires the Gateway's `allowInsecureAuth` option. Add this to your `~/.openclaw/openclaw.json` under the `gateway` key:

```json
{
  "gateway": {
    "controlUi": {
      "allowInsecureAuth": true,
      "allowedOrigins": ["http://localhost:4200"]
    }
  }
}
```

> **Note:** If you've already run ClawConnect setup, this config change was applied automatically. A backup exists at `~/.openclaw/openclaw.json.bak`.

After changing config, restart the Gateway:

```bash
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
```

### 3. Get Your Auth Token

Your Gateway requires token authentication. The token is in `~/.openclaw/openclaw.json`:

```bash
grep -A1 '"token"' ~/.openclaw/openclaw.json
```

For this installation, the token is:

```
e788f2fb967a4330a44cf0256dbd0e9aac53ab2408853d96
```

> **⚠️ Keep this token secret** — anyone with it can access your Gateway. If compromised, regenerate it via the OpenClaw CLI.

---

## Running

### Development Server

```bash
npm start
# or
npx ng serve --port 4200
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

### Production Build

```bash
npm run build
```

Output goes to `dist/clawcoder/`.

---

## Testing the Connection

### Step 1: Verify the Gateway is Running

```bash
curl -s http://127.0.0.1:18789/ | head -1
# Should return HTML (the Gateway's control UI)
```

### Step 2: Connect via ClawConnect

1. Open [http://localhost:4200](http://localhost:4200)
2. Click **Connection Settings** to expand the panel
3. Set **Gateway URL** to `ws://localhost:18789`
4. Paste your auth token into the **Auth Token** field
5. Click **Connect**
6. The header should show a green dot with **"Connected"**

### Step 3: Send a Test Message

1. Type a message in the input area (e.g., "Hello, who are you?")
2. Press **Enter** or click the send button
3. The AI's response should appear in the chat within a few seconds

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Status stays "Connecting" | Gateway not running | Start OpenClaw: `openclaw up` |
| "Error" status | Wrong URL or token | Check `~/.openclaw/openclaw.json` for correct port and token |
| "origin not allowed" | Missing allowed origin | Add `http://localhost:4200` to `controlUi.allowedOrigins` in config |
| "missing scope: operator.write" | `allowInsecureAuth` not set | Add `controlUi.allowInsecureAuth: true` to Gateway config |
| "[object Object]" in messages | Outdated service code | Ensure `extractContent()` is present in `openclaw.service.ts` |

---

## Remote Screen Sharing

ClawConnect includes a **Screen Share** tab that lets you remotely view and control your Mac's screen using VNC, accessible from any browser on your Tailscale network.

### How It Works

```
Browser (noVNC)  ──WebSocket──▶  ws-proxy.js  ──TCP──▶  macOS VNC (:5900)
     :4200                         :6080                  Screen Sharing
```

- **noVNC** renders the remote desktop in a `<canvas>` element inside the browser
- **ws-proxy.js** translates between WebSocket (what browsers speak) and raw TCP (what VNC speaks)
- **macOS Screen Sharing** is Apple's built-in VNC server (port 5900)

### Prerequisites

1. **macOS Screen Sharing enabled** on the target Mac
2. **Tailscale** running on both machines (for secure remote access)
3. **Node.js** ≥ 18 (for the WebSocket proxy)

### Setup (One-Time)

#### Step 1: Enable macOS Screen Sharing

Open **System Settings → General → Sharing → Screen Sharing** and turn it on.

Then enable legacy VNC access (run once in Terminal):

```bash
sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -activate -configure -access -on -privs -all -restart -agent -menu
```

Verify it's working:

```bash
echo "" | nc -w 2 localhost 5900 | head -c 12
# Should output: RFB 003.889
```

> **Note:** On macOS 26+, port 5900 is socket-activated by launchd — it won't appear in `lsof` until a connection arrives, but it works.

#### Step 2: Install Tailscale

Download from [tailscale.com](https://tailscale.com/download) and sign in on both machines. Note your Mac's Tailscale IP:

```bash
tailscale ip -4
# Example: 100.99.145.23
```

#### Step 3: Install the WebSocket Proxy Dependencies

```bash
cd claw-connect
npm install   # ws package is included in dependencies
```

### Running the Screen Share

#### 1. Start the WebSocket Proxy

On the **Mac whose screen you want to share**, run:

```bash
node ws-proxy.js 6080 localhost:5900
```

You should see:
```
[ws-proxy] Listening on :6080 → localhost:5900
```

> **Tip:** To run in the background: `node ws-proxy.js 6080 localhost:5900 &`

#### 2. Start ClawConnect

```bash
npm start
```

#### 3. Connect from the Browser

1. Open [http://localhost:4200](http://localhost:4200)
2. Click the **🖥️ Screen Share** tab
3. Fill in the connection details:

| Field | Value | Notes |
|-------|-------|-------|
| **Tailscale IP** | `100.x.y.z` | Your Mac's Tailscale IP (use `localhost` if connecting to yourself) |
| **WebSocket Port** | `6080` | Default port for ws-proxy.js |
| **Mac Username** | `yourusername` | Your macOS login username |
| **Mac Password** | `yourpassword` | Your macOS login password |

4. Click **Connect**
5. Your Mac's desktop should appear in the viewer

### Screen Share Controls

| Button | Action |
|--------|--------|
| **⛶ Fullscreen** | Toggle fullscreen mode |
| **⊞ Scale to Fit** | Toggle auto-scaling to fit the viewer |
| **Ctrl+Alt+Del** | Send the key combination to the remote Mac |
| **✕ Disconnect** | End the VNC session |

### Troubleshooting Screen Share

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Connecting..." hangs forever | ws-proxy.js not running | Start proxy: `node ws-proxy.js 6080 localhost:5900` |
| "Connecting..." then disconnects | Port 5900 not activated | Run the `kickstart` command in Step 1 |
| "Authentication failure" | Wrong Mac username/password | Use your **macOS login** credentials, not a separate VNC password |
| "Failed to fetch dynamically imported module" | noVNC files missing | Check that `public/novnc/core/rfb.js` exists |
| Viewer shows black screen | macOS screen locked | Unlock the Mac's screen or log in |
| Connection drops when accessing remotely | Firewall blocking port 6080 | Ensure Tailscale is connected; port 6080 must be reachable |

---

## Design

ClawConnect uses a premium dark theme with:

- **Animated background gradients** (deep blue → teal → purple)
- **Glassmorphism** effects (frosted glass panels)
- **OpenClaw lobster-red** (`#FF4500`) accent color
- **Typography**: Inter (UI) + JetBrains Mono (code)
- **Custom scrollbars** matching the dark theme
- **Responsive layout** that works on all screen sizes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular 19 (standalone components) |
| Language | TypeScript 5.9 |
| Styling | Vanilla CSS (custom properties) |
| Fonts | Google Fonts (Inter, JetBrains Mono) |
| Protocol | OpenClaw Gateway Protocol v3 (WebSocket) |
| Remote Desktop | noVNC 1.5.0 (ESM, loaded from `public/`) |
| VNC Proxy | Custom Node.js WebSocket-to-TCP (`ws-proxy.js`) |
| Networking | Tailscale (secure P2P mesh VPN) |
| State | Angular Signals |

---

## License

Private project — for personal use with OpenClaw.
