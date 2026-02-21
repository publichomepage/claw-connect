# 🦞 ClawConnect

A premium web interface for [OpenClaw](https://openclaw.ai) — chat with your AI assistant and remotely view your Mac's screen, all from the browser.

**Live:** [claw-connect.pages.dev](https://claw-connect.pages.dev)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              ClawConnect  (Angular 21 SPA)               │
│          Hosted on Cloudflare Pages (HTTPS)              │
│                                                          │
│   ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│   │    Chat     │  │  Messages  │  │   Screen Share   │  │
│   │  Component  │  │  Component │  │    Component     │  │
│   └─────┬──────┘  └─────┬──────┘  └────────┬─────────┘  │
│         └───────┬───────┘                   │            │
│      ┌──────────▼──────────┐     ┌──────────▼─────────┐  │
│      │   OpenClawService   │     │   noVNC (RFB.js)   │  │
│      │  (Gateway Proto v3) │     │   ESM from public/ │  │
│      └──────────┬──────────┘     └──────────┬─────────┘  │
└─────────────────┼──────────────────────────┼─────────────┘
                  │ WSS                      │ WSS
                  ▼                          ▼
     ┌────────────────────┐     ┌────────────────────────┐
     │  Tailscale Funnel  │     │   Tailscale Funnel     │
     │       :8443        │     │        :443            │
     └────────┬───────────┘     └───────────┬────────────┘
              │                             │
              ▼                             ▼
     ┌────────────────────┐     ┌────────────────────────┐
     │  OpenClaw Gateway  │     │  ws-proxy.js (Node.js) │
     │  localhost:18789   │     │   WS:6080 → TCP:5900   │
     └────────────────────┘     └───────────┬────────────┘
                                            │ TCP
                                            ▼
                                 ┌────────────────────┐
                                 │ macOS Screen Share  │
                                 │   VNC on :5900     │
                                 └────────────────────┘
```

---

## Quick Start

### 1. Install & Configure

```bash
npm install
npm run setup        # configures CORS, auth, and prints your token
```

### 2. Start OpenClaw Gateway

```bash
openclaw start
```

### 3. Expose via Tailscale Funnel

```bash
# Chat — exposes Gateway on port 8443
tailscale funnel --bg --https=8443 http://localhost:18789

# Screen Share — start ws-proxy, then expose on port 443
node ws-proxy.js 6080 localhost:5900 &
tailscale funnel --bg 6080
```

> **Tip:** Use `tailscale funnel status` to verify both funnels are active.

### 4. Connect

Open [claw-connect.pages.dev](https://claw-connect.pages.dev) and configure:

| Setting | Value |
|---------|-------|
| **Gateway Host** | `your-mac.tailnet.ts.net` |
| **Gateway Port** | `8443` |
| **Auth Token** | From `npm run setup` output |

For Screen Share:

| Setting | Value |
|---------|-------|
| **Tailscale Domain** | `your-mac.tailnet.ts.net` |
| **WebSocket Port** | `443` |
| **Mac Username/Password** | Your macOS login credentials |

---

## Development

```bash
npm start              # Dev server at http://localhost:4200
npm run build          # Production build → dist/ClawConnect/
```

### Deploy to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist/ClawConnect/browser --project-name=claw-connect
```

---

## Screen Share Prerequisites

1. **Enable Screen Sharing** — System Settings → General → Sharing → Screen Sharing

2. **Enable legacy VNC access** (run once):
   ```bash
   sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
     -activate -configure -access -on -privs -all -restart -agent -menu
   ```

3. **Verify VNC is working:**
   ```bash
   echo "" | nc -w 2 localhost 5900 | head -c 12
   # Should output: RFB 003.889
   ```

> On macOS 26+, port 5900 is socket-activated by launchd — it won't appear in `lsof` until a connection arrives, but it works.

---

## Troubleshooting

### Chat

| Symptom | Fix |
|---------|-----|
| Status stays "Connecting" | Ensure Gateway is running: `openclaw start` |
| "Connection Failed" error | Check Tailscale funnel: `tailscale funnel status` |
| Wrong URL or token | Verify settings in `~/.openclaw/openclaw.json` |
| "origin not allowed" | Run `npm run setup` to configure CORS |

### Screen Share

| Symptom | Fix |
|---------|-----|
| Hangs on "Connecting" | Start proxy: `node ws-proxy.js 6080 localhost:5900` |
| Connects then drops | Run the `kickstart` command above to enable VNC |
| "Authentication failure" | Use your **macOS login** credentials |
| Black screen | Unlock the Mac or log in |

---

## Project Structure

```
src/app/
├── components/
│   ├── chat/          # Main layout — chat + screen share panels
│   ├── message/       # Individual message rendering
│   ├── screen-share/  # Remote VNC viewer via noVNC
│   └── settings/      # Chat connection settings
├── services/
│   ├── openclaw.service.ts       # Gateway Protocol v3 WebSocket client
│   └── screen-share.service.ts   # noVNC connection management
public/novnc/          # noVNC ESM source (v1.5.0)
ws-proxy.js            # WebSocket-to-TCP bridge for VNC
setup.js               # Auto-configuration script
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular 21 (standalone components, signals) |
| Styling | Vanilla CSS (dark theme, glassmorphism) |
| Fonts | Inter + JetBrains Mono |
| Remote Desktop | noVNC 1.5.0 |
| VNC Proxy | Node.js `ws` package |
| Networking | Tailscale Funnel |
| Hosting | Cloudflare Pages |

---

*Private project — for personal use with OpenClaw.*
