# 🦞 ClawConnect

A premium web interface for [OpenClaw](https://openclaw.ai) — chat with your AI assistant and remotely view your Mac's screen, all from the browser and without hoping between different apps. Built to help find a simpler solution for the browser and avoid polluting personal chat apps with tons of messages.

**Live:** [claw.publichome.page](https://claw.publichome.page)

---

## Architecture

clawconnect has a very simple architecture, uses wss and you need a tailscale connection / funnel .

---

## Magic Setup (macOS)

The absolute easiest way to get started. This script installs Node, OpenClaw, Tailscale, and configures everything for you.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/publichomepage/claw-connect/main/install.sh)"
```

---

## Magic Setup (Windows)

Open PowerShell as Administrator and run:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/publichomepage/claw-connect/main/install.ps1'))
```

---

## Alternative: Manual One-Liner

If you already have prerequisites installed, you can use `npx` to just configure Gateway CORS and (optionally) start the Screen Share proxy.

```bash
# Configure Gateway & get your token
npx -y claw-connect-onboard

# To also start the Screen Share proxy
npx -y claw-connect-onboard --proxy
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
openclaw gateway status  # Verify it is running
```

### 3. Automatic Background Exposure

The **Magic Setup** (install scripts) automatically configures everything to run in the background. If you prefer to set up manually, follow these steps:

```bash
# 1. Start Chat (Gateway) Funnel
tailscale funnel --bg --https=8443 http://localhost:18789

# 2. Start Screen Share Proxy & Funnel
node onboard.js --proxy > /dev/null 2>&1 &
```

> **Note:** Screen sharing is no longer optional; the scripts now background everything by default for a seamless experience. Use `tailscale funnel status` to verify exposure.

> **Tip:** Use `tailscale funnel status` to verify both funnels are active.

### 4. Connect

Open [claw.publichome.page](https://claw.publichome.page) and configure:

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

## Deployment

```bash
npm run build
# Deploy the contents of dist/ClawConnect/browser/ to your hosting provider
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
| Status stays "Connecting" | Ensure Gateway is running: `openclaw gateway status` |
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
onboard.js             # Onboarding launcher (npx)
install.sh / ps1       # Platform-specific Magic Setup scripts
LICENSE                # MIT License
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular 21 (standalone components, signals) |
| Remote Desktop | noVNC 1.5.0 |
| VNC Proxy | Node.js `ws` package |
| Networking | Tailscale Funnel |
| Hosting | Generic (Static) |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

*For use with [OpenClaw](https://openclaw.ai).*
