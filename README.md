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
┌─────────────────────────────────────────────────┐
│                  ClawConnect App                   │
│                (Angular 19 SPA)                  │
│                                                  │
│  ┌─────────────┐  ┌──────────┐  ┌────────────┐  │
│  │   ChatComp  │  │ MsgComp  │  │ SettingsComp│  │
│  │  (main UI)  │  │(messages)│  │  (config)   │  │
│  └──────┬──────┘  └────┬─────┘  └──────┬─────┘  │
│         │              │               │         │
│         └──────────┬───┘               │         │
│                    │                   │         │
│         ┌──────────▼───────────────────▼──┐      │
│         │       OpenClawService           │      │
│         │  (WebSocket + Protocol v3)      │      │
│         └──────────────┬──────────────────┘      │
└────────────────────────┼─────────────────────────┘
                         │ WebSocket
                         ▼
              ┌──────────────────────┐
              │   OpenClaw Gateway   │
              │  (localhost:18789)   │
              └──────────────────────┘
```

### Project Structure

```
src/app/
├── app.ts                          # Root component
├── app.config.ts                   # Angular configuration
├── components/
│   ├── chat/chat.component.ts      # Main chat container (header, messages, input)
│   ├── message/message.component.ts# Individual message (user/assistant/system)
│   └── settings/settings.component.ts # Connection settings panel
└── services/
    └── openclaw.service.ts         # WebSocket client implementing Gateway Protocol v3
```

### Key Files

| File | Purpose |
|------|---------|
| `openclaw.service.ts` | Core WebSocket service — handles Gateway Protocol v3 handshake, request/response framing, session management, streaming, history loading, and structured content parsing |
| `chat.component.ts` | Main UI — message list, input area, connection status, typing indicator, auto-scroll |
| `message.component.ts` | Message bubble — role-based styling (user/assistant/system), markdown rendering, timestamps |
| `settings.component.ts` | Config panel — Gateway URL, auth token/password, localStorage persistence |
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
| State | Angular Signals |

---

## License

Private project — for personal use with OpenClaw.
