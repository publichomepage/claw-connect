import { Injectable, signal } from '@angular/core';

export type ScreenShareStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface VncConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class ScreenShareService {
  readonly status = signal<ScreenShareStatus>('disconnected');
  readonly errorMessage = signal<string>('');
  readonly statusMessage = signal<string>('');
  readonly scaleViewport = signal<boolean>(true);

  /** Shared with the gateway host setting so both panels stay in sync. */
  sharedHost = signal<string>('');

  private rfb: any = null;
  private RFBClass: any = null;

  // ── Reconnect state ────────────────────────────────────────────────────────
  private lastConfig: VncConfig | null = null;
  private lastContainer: HTMLElement | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private userDisconnected = false;

  /**
   * Incremented every time teardown() is called.
   * Each establish() captures the current value in a closure; the disconnect
   * listener compares against it to detect stale listeners on old rfb objects.
   * This prevents a teardown inside a fresh establish() from triggering an
   * unwanted scheduleReconnect() via the previous rfb's event handler.
   */
  private sessionId = 0;

  /**
   * True only after the 'connect' event fires at least once in this session.
   * Auto-reconnect is only enabled for drops that happen AFTER a successful
   * connection — not for initial failures (server unreachable, wrong host).
   */
  private everConnected = false;

  // ── Public API ─────────────────────────────────────────────────────────────

  async connect(config: VncConfig, container: HTMLElement): Promise<void> {
    if (!config.host) return;

    this.lastConfig = config;
    this.lastContainer = container;
    this.userDisconnected = false;
    this.everConnected = false;
    this.reconnectAttempts = 0;
    this.cancelReconnect();

    await this.establish(config, container);
  }

  /** Explicit user disconnect — never triggers auto-reconnect. */
  disconnect(): void {
    this.userDisconnected = true;
    this.cancelReconnect();
    this.teardown();
    this.status.set('disconnected');
    this.errorMessage.set('');
    this.statusMessage.set('Disconnected');
  }

  toggleScaleViewport(): void {
    this.scaleViewport.update(v => !v);
    if (this.rfb) {
      this.rfb.scaleViewport = this.scaleViewport();
    }
  }



  /**
   * Forces the noVNC viewer to recalculate its scaling and viewport.
   * Useful when the device orientation changes or the container is resized.
   */
  recalculateScaling(): void {
    if (this.rfb && this.scaleViewport()) {
      // Re-applying the scaleViewport property triggers noVNC's internal 
      // scaling logic which recalculates based on the current container size.
      this.rfb.scaleViewport = false;
      // Small tick to ensure the DOM layout has settled
      setTimeout(() => {
        if (this.rfb) {
          this.rfb.scaleViewport = true;
        }
      }, 10);
    }
  }

  async preloadNoVNC(): Promise<void> {
    try { await this.ensureNoVNCLoaded(); } catch { /* retry on connect */ }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async establish(config: VncConfig, container: HTMLElement): Promise<void> {
    // Invalidate any listeners from a previous rfb before we tear it down.
    // The old rfb's disconnect listener checks this value; if it no longer
    // matches the captured sessionId it exits silently.
    this.teardown();

    this.status.set('connecting');
    this.statusMessage.set(`Connecting to ${config.host}:${config.port}...`);
    this.errorMessage.set('');

    // Capture the session so the listeners below belong only to THIS rfb.
    const mySession = this.sessionId;

    try {
      await this.ensureNoVNCLoaded();

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${protocol}://${config.host}:${config.port}`;

      const creds: any = {};
      if (config.username) creds.username = config.username;
      if (config.password) creds.password = config.password;

      this.rfb = new this.RFBClass(container, url, {
        credentials: Object.keys(creds).length > 0 ? creds : undefined,
      });

      this.rfb.scaleViewport = this.scaleViewport();
      this.rfb.resizeSession = false;
      this.rfb.clipViewport = true;
      this.rfb.showDotCursor = true;
      this.rfb.background = '#0a0a0f';

      this.rfb.addEventListener('connect', () => {
        if (this.sessionId !== mySession) return; // stale listener
        this.everConnected = true;
        this.reconnectAttempts = 0;
        this.status.set('connected');
        this.statusMessage.set(`Connected to ${config.host}`);
      });

      this.rfb.addEventListener('disconnect', (e: any) => {
        if (this.sessionId !== mySession) return; // stale — teardown in progress
        this.rfb = null;

        if (e.detail?.clean || this.userDisconnected) {
          this.status.set('disconnected');
          this.statusMessage.set('Disconnected');
        } else if (this.everConnected) {
          // Was working and dropped unexpectedly (layout change, network blip)
          this.scheduleReconnect();
        } else {
          // Never managed to connect — don't loop, show error immediately
          this.status.set('error');
          this.errorMessage.set('Could not connect');
          this.statusMessage.set(`Could not connect to ${config.host}:${config.port} — check host, port, and ws-proxy.`);
        }
      });

      this.rfb.addEventListener('credentialsrequired', (e: any) => {
        if (this.sessionId !== mySession) return;
        const types: string[] = e.detail?.types || [];
        const needsUser = types.includes('username');
        const needsPass = types.includes('password');

        if ((needsUser && !config.username) || (needsPass && !config.password)) {
          const missing = [
            ...(needsUser && !config.username ? ['Mac username'] : []),
            ...(needsPass && !config.password ? ['Mac password'] : []),
          ];
          // Missing credentials won't fix themselves — block reconnect
          this.userDisconnected = true;
          this.statusMessage.set(`Authentication required — enter ${missing.join(' and ')} above`);
          this.status.set('error');
          this.errorMessage.set('Auth required');
          return;
        }

        const sendCreds: any = {};
        if (config.username) sendCreds.username = config.username;
        if (config.password) sendCreds.password = config.password;
        this.rfb.sendCredentials(sendCreds);
      });

      this.rfb.addEventListener('securityfailure', (e: any) => {
        if (this.sessionId !== mySession) return;
        // Wrong password won't fix itself — block reconnect
        this.userDisconnected = true;
        this.statusMessage.set(`Authentication failed: ${e.detail?.reason || 'wrong password'}`);
        this.status.set('error');
        this.errorMessage.set('Auth failed');
      });

    } catch (err: any) {
      if (this.sessionId !== mySession) return;
      this.status.set('error');
      this.errorMessage.set(err.message || String(err));
      this.statusMessage.set(`Failed to load VNC library: ${err.message || err}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.userDisconnected) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.status.set('error');
      this.errorMessage.set('Connection lost');
      this.statusMessage.set(`Reconnect failed after ${this.maxReconnectAttempts} attempts. Check ws-proxy and Tailscale.`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

    this.status.set('connecting');
    this.statusMessage.set(`Reconnecting in ${Math.round(delay / 1000)}s… (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.userDisconnected && this.lastConfig && this.lastContainer) {
        this.establish(this.lastConfig, this.lastContainer);
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Bump sessionId FIRST so in-flight listeners on the old rfb become no-ops. */
  private teardown(): void {
    this.sessionId++;
    const rfb = this.rfb;
    this.rfb = null;
    if (rfb) {
      try { rfb.disconnect(); } catch { /* ignore */ }
    }
  }

  private async ensureNoVNCLoaded(): Promise<void> {
    if (this.RFBClass) return;
    // Standard dynamic import — Angular/esbuild bundles noVNC into a lazy
    // chunk at build time, so no separate static file fetch is needed at
    // runtime. This is what makes it work on Cloudflare Pages (and anywhere
    // else) without relying on /novnc/core/rfb.js being hosted separately.
    // noVNC ships as ES modules with top-level await — they cannot be bundled
    // by esbuild. Instead, the files live in public/novnc/ and are deployed as
    // static assets alongside the Angular app. new Function() prevents the
    // bundler from trying to statically analyse this import.
    const mod = await (new Function('u', 'return import(u)'))('/novnc/core/rfb.js');
    this.RFBClass = mod.default ?? mod;
  }
}
