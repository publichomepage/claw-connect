import { Component, ElementRef, ViewChild, OnDestroy, signal, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface ScreenShareConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}

@Component({
    selector: 'app-screen-share',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="screen-share-container">
      <!-- Config Panel -->
      <div class="config-panel" [class.collapsed]="isConnected()">
        <div class="config-header" (click)="toggleConfig()">
          <span class="config-icon">🔗</span>
          <span class="config-title">Tailscale Connection</span>
          <span class="config-chevron" [class.rotated]="configOpen()">›</span>
        </div>

        @if (configOpen()) {
          <div class="config-body">
            <div class="config-fields">
              <div class="field-row">
                <div class="field">
                  <label for="ts-host">Tailscale IP Address</label>
                  <input
                    type="text"
                    id="ts-host"
                    [(ngModel)]="host"
                    placeholder="100.x.y.z"
                    (change)="saveConfig()"
                  />
                </div>
                <div class="field">
                  <label for="ts-port">WebSocket Port</label>
                  <input
                    type="number"
                    id="ts-port"
                    [(ngModel)]="port"
                    placeholder="6080"
                    (change)="saveConfig()"
                  />
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="vnc-user">Mac Username</label>
                  <input
                    type="text"
                    id="vnc-user"
                    [(ngModel)]="username"
                    placeholder="your-mac-username"
                    (change)="saveConfig()"
                  />
                </div>
                <div class="field">
                  <label for="vnc-pass">Mac Password</label>
                  <input
                    type="password"
                    id="vnc-pass"
                    [(ngModel)]="password"
                    placeholder="Mac login password"
                    (change)="saveConfig()"
                  />
                </div>
              </div>
            </div>
            <div class="config-actions">
              <button
                class="btn btn-connect"
                [disabled]="!host || isConnecting()"
                (click)="connect()"
              >
                @if (isConnecting()) {
                  <span class="spinner"></span> Connecting...
                } @else {
                  🖥️ Connect
                }
              </button>
              @if (isConnected()) {
                <button class="btn btn-disconnect" (click)="disconnect()">
                  Disconnect
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Status Messages -->
      @if (statusMessage()) {
        <div class="status-bar" [class]="'status-' + statusType()">
          <span class="status-icon">
            @switch (statusType()) {
              @case ('success') { ✅ }
              @case ('error') { ❌ }
              @case ('info') { ℹ️ }
              @default { ⏳ }
            }
          </span>
          <span>{{ statusMessage() }}</span>
        </div>
      }

      <!-- VNC Viewer Area -->
      <div class="viewer-area" [class.active]="isConnected()">
        @if (!isConnected() && !isConnecting()) {
          <div class="placeholder">
            <div class="placeholder-icon">🖥️</div>
            <h3 class="placeholder-title">Remote Screen Control</h3>
            <p class="placeholder-text">
              Connect to your Mac via Tailscale to view and control your screen remotely.
            </p>
            <div class="prereqs">
              <div class="prereq-title">Prerequisites:</div>
              <div class="prereq-item">
                <span class="prereq-bullet">1</span>
                Enable Screen Sharing in macOS Settings
              </div>
              <div class="prereq-item">
                <span class="prereq-bullet">2</span>
                Run Tailscale on your Mac
              </div>
              <div class="prereq-item">
                <span class="prereq-bullet">3</span>
                Start websockify: <code>websockify 6080 localhost:5900</code>
              </div>
            </div>
          </div>
        }
        <div #vncContainer class="vnc-container" [class.visible]="isConnected()"></div>
      </div>

      <!-- Toolbar (shown when connected) -->
      @if (isConnected()) {
        <div class="toolbar">
          <button class="tool-btn" (click)="toggleFullscreen()" title="Fullscreen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            Fullscreen
          </button>
          <button class="tool-btn" (click)="toggleScaleViewport()" title="Scale to Fit" [class.active]="scaleViewport()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Scale to Fit
          </button>
          <button class="tool-btn" (click)="sendCtrlAltDel()" title="Send Ctrl+Alt+Del">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h.01M18 16h.01"/>
            </svg>
            Ctrl+Alt+Del
          </button>
          <div class="toolbar-spacer"></div>
          <button class="tool-btn tool-btn-danger" (click)="disconnect()">
            Disconnect
          </button>
        </div>
      }
    </div>
  `,
    styles: [`
    .screen-share-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 10px;
    }

    /* Config Panel */
    .config-panel {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .config-panel:not(.collapsed):hover,
    .config-panel.collapsed {
      border-color: rgba(255, 69, 0, 0.15);
    }

    .config-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s;
    }

    .config-header:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    .config-icon { font-size: 16px; }

    .config-title {
      font-size: 13px;
      font-weight: 600;
      color: #b0b0b0;
      letter-spacing: 0.3px;
      flex: 1;
    }

    .config-chevron {
      font-size: 18px;
      color: #666;
      transition: transform 0.3s;
    }

    .config-chevron.rotated {
      transform: rotate(90deg);
    }

    .config-body {
      padding: 0 18px 18px;
      animation: configExpand 0.3s ease;
    }

    @keyframes configExpand {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .config-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .field-row {
      display: flex;
      gap: 12px;
    }

    .field-row .field {
      flex: 1;
    }

    .field {
      margin-bottom: 0;
    }

    .field label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #808080;
      margin-bottom: 6px;
    }

    .field input {
      width: 100%;
      padding: 10px 14px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #e0e0e0;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }

    .field input:focus {
      border-color: rgba(255, 69, 0, 0.5);
      box-shadow: 0 0 0 3px rgba(255, 69, 0, 0.1);
    }

    .field input::placeholder {
      color: #555;
    }

    .field input[type="number"] {
      -moz-appearance: textfield;
    }

    .field input[type="number"]::-webkit-inner-spin-button,
    .field input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .config-actions {
      display: flex;
      gap: 10px;
      margin-top: 16px;
    }

    .btn {
      flex: 1;
      padding: 10px 0;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-connect {
      background: linear-gradient(135deg, #FF4500, #E63E00);
      color: white;
    }

    .btn-connect:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(255, 69, 0, 0.3);
    }

    .btn-connect:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-disconnect {
      background: rgba(255, 255, 255, 0.08);
      color: #b0b0b0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-disconnect:hover {
      background: rgba(244, 67, 54, 0.15);
      color: #f44336;
      border-color: rgba(244, 67, 54, 0.3);
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Status Bar */
    .status-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      animation: statusSlideIn 0.3s ease;
    }

    @keyframes statusSlideIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .status-success {
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.2);
      color: #81C784;
    }

    .status-error {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.2);
      color: #EF9A9A;
    }

    .status-info {
      background: rgba(33, 150, 243, 0.1);
      border: 1px solid rgba(33, 150, 243, 0.2);
      color: #90CAF9;
    }

    .status-connecting {
      background: rgba(255, 152, 0, 0.1);
      border: 1px solid rgba(255, 152, 0, 0.2);
      color: #FFCC80;
    }

    .status-icon { font-size: 14px; }

    /* Viewer Area */
    .viewer-area {
      flex: 1;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      overflow: hidden;
      position: relative;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.3s;
    }

    .viewer-area.active {
      border-color: rgba(76, 175, 80, 0.2);
      background: #000;
    }

    .vnc-container {
      width: 100%;
      height: 100%;
      display: none;
    }

    .vnc-container.visible {
      display: block;
    }

    /* Placeholder */
    .placeholder {
      text-align: center;
      padding: 40px 20px;
      max-width: 420px;
    }

    .placeholder-icon {
      font-size: 56px;
      margin-bottom: 16px;
      animation: monitorPulse 3s ease-in-out infinite;
    }

    @keyframes monitorPulse {
      0%, 100% { transform: scale(1); opacity: 0.9; }
      50% { transform: scale(1.05); opacity: 1; }
    }

    .placeholder-title {
      font-size: 20px;
      font-weight: 700;
      color: #e0e0e0;
      margin: 0 0 8px;
    }

    .placeholder-text {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
      margin: 0 0 24px;
    }

    .prereqs {
      text-align: left;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 16px 20px;
    }

    .prereq-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 12px;
    }

    .prereq-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #aaa;
      margin-bottom: 8px;
    }

    .prereq-item:last-child { margin-bottom: 0; }

    .prereq-bullet {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #FF4500, #E63E00);
      color: white;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .prereq-item code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: rgba(255, 69, 0, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      color: #FF6B35;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      animation: toolbarSlideIn 0.3s ease;
    }

    @keyframes toolbarSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .tool-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      color: #b0b0b0;
      font-size: 12px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tool-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #e0e0e0;
      border-color: rgba(255, 255, 255, 0.15);
    }

    .tool-btn.active {
      background: rgba(255, 69, 0, 0.15);
      border-color: rgba(255, 69, 0, 0.3);
      color: #FF6B35;
    }

    .tool-btn-danger {
      color: #EF9A9A;
    }

    .tool-btn-danger:hover {
      background: rgba(244, 67, 54, 0.15);
      color: #f44336;
      border-color: rgba(244, 67, 54, 0.3);
    }

    .toolbar-spacer { flex: 1; }

    /* Responsive */
    @media (max-width: 640px) {
      .field-row {
        flex-direction: column;
      }

      .toolbar {
        flex-wrap: wrap;
      }

      .toolbar-spacer { display: none; }
    }
  `]
})
export class ScreenShareComponent implements OnDestroy, AfterViewInit {
    @ViewChild('vncContainer') private vncContainer!: ElementRef<HTMLDivElement>;

    host = '';
    port = 6080;
    username = '';
    password = '';

    readonly isConnected = signal(false);
    readonly isConnecting = signal(false);
    readonly configOpen = signal(true);
    readonly statusMessage = signal('');
    readonly statusType = signal<'success' | 'error' | 'info' | 'connecting'>('info');
    readonly scaleViewport = signal(true);

    private rfb: any = null;
    private noVNCLoaded = false;
    private RFBClass: any = null;

    constructor() {
        this.loadConfig();
    }

    ngAfterViewInit(): void {
        this.loadNoVNC();
    }

    ngOnDestroy(): void {
        this.disconnect();
    }

    toggleConfig(): void {
        this.configOpen.update(v => !v);
    }

    async connect(): Promise<void> {
        if (!this.host) return;

        this.isConnecting.set(true);
        this.statusMessage.set('Connecting to ' + this.host + ':' + this.port + '...');
        this.statusType.set('connecting');
        this.saveConfig();

        try {
            await this.ensureNoVNCLoaded();

            if (this.rfb) {
                this.rfb.disconnect();
                this.rfb = null;
            }

            const url = `ws://${this.host}:${this.port}`;
            const container = this.vncContainer.nativeElement;

            const creds: any = {};
            if (this.username) creds.username = this.username;
            if (this.password) creds.password = this.password;

            this.rfb = new this.RFBClass(container, url, {
                credentials: Object.keys(creds).length > 0 ? creds : undefined,
            });

            this.rfb.scaleViewport = this.scaleViewport();
            this.rfb.resizeSession = false;
            this.rfb.clipViewport = true;
            this.rfb.showDotCursor = true;
            this.rfb.background = '#0a0a0f';

            this.rfb.addEventListener('connect', () => {
                this.isConnected.set(true);
                this.isConnecting.set(false);
                this.statusMessage.set('Connected to ' + this.host);
                this.statusType.set('success');
                this.configOpen.set(false);
            });

            this.rfb.addEventListener('disconnect', (e: any) => {
                this.isConnected.set(false);
                this.isConnecting.set(false);
                if (e.detail?.clean) {
                    this.statusMessage.set('Disconnected');
                    this.statusType.set('info');
                } else {
                    this.statusMessage.set('Connection lost — check websockify and Tailscale');
                    this.statusType.set('error');
                }
            });

            this.rfb.addEventListener('credentialsrequired', (e: any) => {
                const types: string[] = e.detail?.types || [];
                const needsUsername = types.includes('username');
                const needsPassword = types.includes('password');

                if ((needsUsername && !this.username) || (needsPassword && !this.password)) {
                    const missing = [];
                    if (needsUsername && !this.username) missing.push('Mac username');
                    if (needsPassword && !this.password) missing.push('Mac password');
                    this.statusMessage.set('Authentication required — enter ' + missing.join(' and ') + ' above');
                    this.statusType.set('error');
                    this.isConnecting.set(false);
                    this.configOpen.set(true);
                    return;
                }

                const creds: any = {};
                if (this.username) creds.username = this.username;
                if (this.password) creds.password = this.password;
                this.rfb.sendCredentials(creds);
            });

            this.rfb.addEventListener('securityfailure', (e: any) => {
                this.statusMessage.set('Authentication failed: ' + (e.detail?.reason || 'wrong password'));
                this.statusType.set('error');
                this.isConnecting.set(false);
                this.configOpen.set(true);
            });
        } catch (err: any) {
            this.isConnecting.set(false);
            this.statusMessage.set('Failed to connect: ' + (err.message || err));
            this.statusType.set('error');
        }
    }

    disconnect(): void {
        if (this.rfb) {
            try {
                this.rfb.disconnect();
            } catch {
                // Ignore
            }
            this.rfb = null;
        }
        this.isConnected.set(false);
        this.isConnecting.set(false);
        this.statusMessage.set('Disconnected');
        this.statusType.set('info');
        this.configOpen.set(true);
    }

    toggleFullscreen(): void {
        const container = this.vncContainer?.nativeElement;
        if (!container) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    }

    toggleScaleViewport(): void {
        this.scaleViewport.update(v => !v);
        if (this.rfb) {
            this.rfb.scaleViewport = this.scaleViewport();
        }
    }

    sendCtrlAltDel(): void {
        if (this.rfb) {
            this.rfb.sendCtrlAltDel();
        }
    }

    saveConfig(): void {
        localStorage.setItem('clawconnect_screenshare', JSON.stringify({
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
        }));
    }

    private loadConfig(): void {
        try {
            const stored = localStorage.getItem('clawconnect_screenshare');
            if (stored) {
                const config: ScreenShareConfig = JSON.parse(stored);
                this.host = config.host || '';
                this.port = config.port || 6080;
                this.username = config.username || '';
                this.password = config.password || '';
            }
        } catch {
            // Use defaults
        }
    }

    private async loadNoVNC(): Promise<void> {
        if (this.noVNCLoaded) return;
        try {
            // Load noVNC RFB from local assets (public/novnc/core/)
            const module = await (new Function('return import("/novnc/core/rfb.js")'))();
            this.RFBClass = module.default;
            this.noVNCLoaded = true;
        } catch (err) {
            console.warn('noVNC preload failed, will retry on connect:', err);
        }
    }

    private async ensureNoVNCLoaded(): Promise<void> {
        if (this.RFBClass) return;
        const module = await (new Function('return import("/novnc/core/rfb.js")'))();
        this.RFBClass = module.default;
        this.noVNCLoaded = true;
    }
}
