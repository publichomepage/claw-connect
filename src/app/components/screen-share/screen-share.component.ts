import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, computed, effect, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ScreenShareService } from '../../services/screen-share.service';

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
          <span class="config-title">Tailscale Settings</span>
          <button class="eye-btn" type="button" (click)="$event.stopPropagation(); showAll.set(!showAll())" tabindex="-1" title="Show/hide values">
            @if (showAll()) {
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            }
          </button>
          <span class="config-chevron" [class.rotated]="configOpen()">›</span>
        </div>

        @if (configOpen()) {
          <div class="config-body">
            <div class="config-fields">
              <div class="field-row">
                <div class="field">
                  <label for="ts-host">Tailscale Domain</label>
                  <input
                    [type]="showAll() ? 'text' : 'password'"
                    id="ts-host"
                    [(ngModel)]="host"
                    placeholder="e.g. tailscale-name"
                    (change)="saveConfig()"
                  />
                </div>
                <div class="field">
                  <label for="ts-port">WebSocket Port</label>
                  <input
                    [type]="showAll() ? 'text' : 'password'"
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
                    [type]="showAll() ? 'text' : 'password'"
                    id="vnc-user"
                    [(ngModel)]="username"
                    placeholder="your-mac-username"
                    (change)="saveConfig()"
                  />
                </div>
                <div class="field">
                  <label for="vnc-pass">Mac Password</label>
                  <input
                    [type]="showAll() ? 'text' : 'password'"
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

      @if (ss.status() === 'error' && !errorDismissed()) {
        <div class="connection-error-banner">
          <span class="error-icon">⚠️</span>
          <div class="error-text">
            <strong>Connection Failed</strong>
            <span>{{ ss.statusMessage() || 'Ensure Tailscale is connected and the proxy is running.' }}</span>
          </div>
          <button class="dismiss-btn" (click)="dismissError()" title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
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
                <span class="prereq-text">Enable Screen Sharing in Desktop Settings</span>
              </div>
              <div class="prereq-item">
                <span class="prereq-bullet">2</span>
                <span class="prereq-text">Run the <strong>Magic Setup</strong> (<a href="#" class="magic-link" [class.copied]="copiedCommand() === 'macos'" (click)="copyCommand($event, 'macos')" title="Click to copy macOS install command">{{ copiedCommand() === 'macos' ? 'Copied!' : 'macOS' }}</a> / <a href="#" class="magic-link" [class.copied]="copiedCommand() === 'windows'" (click)="copyCommand($event, 'windows')" title="Click to copy Windows install command">{{ copiedCommand() === 'windows' ? 'Copied!' : 'Windows' }}</a>) to create a Tailscale funnel.</span>
              </div>
            </div>
          </div>
        }
        <div #vncContainer class="vnc-container" [class.visible]="isConnected()"></div>
      </div>

      <!-- Toolbar (shown when connected) -->
      @if (isConnected()) {
        <div class="toolbar">
          <button class="tool-btn hide-text-mobile" (click)="toggleFullscreen()" title="Fullscreen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <span class="btn-text">Fullscreen</span>
          </button>
          <button class="tool-btn hide-text-mobile" (click)="toggleRotate()" title="Rotate View" [class.active]="isRotated()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span class="btn-text">Rotate</span>
          </button>
          <button class="tool-btn hide-text-mobile" (click)="ss.toggleScaleViewport()" title="Scale to Fit" [class.active]="ss.scaleViewport()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span class="btn-text">Scale to Fit</span>
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
    :host {
      display: flex;
      flex: 1;
      height: 100%;
      min-height: 0;
    }

    .screen-share-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      height: 100%;
      gap: 0;
    }

    /* Config Panel */
    .config-panel {
      background: transparent;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .config-panel:not(.collapsed):hover,
    .config-panel.collapsed {
      background: rgba(255, 255, 255, 0.02);
      border-bottom-color: rgba(255, 69, 0, 0.2);
    }

    .config-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
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
      padding: 0 20px 20px;
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

    .eye-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #555;
      padding: 2px 4px;
      display: flex;
      align-items: center;
      border-radius: 4px;
      transition: color 0.2s;
      flex-shrink: 0;
    }

    .eye-btn:hover {
      color: #b0b0b0;
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

    /* Viewer Area */
    .viewer-area {
      flex: 1;
      background: transparent;
      overflow: hidden;
      position: relative;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      transition: background 0.3s;
    }

    .viewer-area.active {
      background: #000;
    }

    .vnc-container {
      width: 100%;
      flex: 1;
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
      margin: auto;
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
      background: transparent;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding: 20px;
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
      align-items: flex-start;
      gap: 10px;
      font-size: 13px;
      color: #aaa;
      margin-bottom: 8px;
    }

    .prereq-text {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px;
      line-height: 1.5;
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

    .magic-link {
      color: #FF6B35;
      text-decoration: underline;
      text-underline-offset: 4px;
      transition: all 0.2s;
      cursor: pointer;
    }

    .magic-link:hover {
      color: #FF4500;
      opacity: 0.8;
    }

    .magic-link.copied {
      color: #4CAF50;
      text-decoration: none;
    }

    /* Connection Error Banner */
    .connection-error-banner {
      margin: 12px 20px 0;
      padding: 12px 16px;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.2);
      border-radius: 12px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      animation: bannerSlideDown 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      flex-shrink: 0;
      position: relative;
    }

    .dismiss-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      padding: 4px;
      margin: -4px -4px 0 0;
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .dismiss-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    @keyframes bannerSlideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .error-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .error-text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .error-text strong {
      color: #f44336;
      font-size: 13px;
      margin-bottom: 2px;
    }

    .error-text span {
      color: #e0e0e0;
      font-size: 12px;
      line-height: 1.4;
      word-wrap: break-word;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 16px 20px;
      background: transparent;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
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
        flex-wrap: nowrap;
        padding: 12px;
        gap: 6px;
      }

      .hide-text-mobile .btn-text {
        display: none;
      }
      
      .tool-btn {
        padding: 8px; /* Square buttons on mobile */
      }

      .toolbar-spacer { display: block; flex: 1; }
    }
  `]
})
export class ScreenShareComponent implements AfterViewInit {
  @ViewChild('vncContainer') private vncContainer!: ElementRef<HTMLDivElement>;

  // Form state (UI only — connection is owned by the service)
  host = '';
  port = location.protocol === 'https:' ? 443 : 6080;
  username = '';
  password = '';

  readonly configOpen = signal(false);
  readonly showAll = signal(false);
  readonly isRotated = signal(false);
  readonly copiedCommand = signal<string | null>(null);

  // True when fullscreen auto-rotated on mobile (so we undo it on exit).
  private autoRotatedForFullscreen = false;
  private readonly mobileQuery = window.matchMedia('(max-width: 767px)');

  readonly isConnected = computed(() => this.ss.status() === 'connected');
  readonly isConnecting = computed(() => this.ss.status() === 'connecting');

  constructor(public ss: ScreenShareService) {
    this.loadConfig();

    // Sync Tailscale Domain from gateway host setting
    effect(() => {
      const newHost = this.ss.sharedHost();
      if (newHost && this.host !== newHost) {
        this.host = newHost;
        this.saveConfig();
      }
    });

    // Auto-manage config panel visibility based on connection state.
    // Only re-open on disconnect/error AFTER we've been connected at least
    // once — otherwise the panel pops open on every fresh page load.
    let wasConnected = false;
    effect(() => {
      const s = this.ss.status();
      if (s === 'connected') {
        wasConnected = true;
        this.configOpen.set(false);
      } else if (wasConnected && (s === 'disconnected' || s === 'error')) {
        this.configOpen.set(true);
      }
    });
  }

  ngAfterViewInit(): void {
    // Preload noVNC so the first connect is instant
    this.ss.preloadNoVNC();
  }

  // ngOnDestroy intentionally omitted — the service owns the connection and
  // must keep it alive across layout/viewport changes. The component is never
  // destroyed (chat.component uses CSS visibility, not @if, for this panel).

  toggleConfig(): void {
    this.configOpen.update(v => !v);
  }

  readonly errorDismissed = signal<boolean>(false);

  async connect(): Promise<void> {
    // Sanitize host — extract just the domain
    let cleanHost = this.host.trim();
    try {
      const urlMatch = cleanHost.match(/https?:\/\/[^\s]+/i) || cleanHost.match(/wss?:\/\/[^\s]+/i);
      if (urlMatch) {
        const url = new URL(urlMatch[0]);
        cleanHost = url.hostname;
      }
    } catch { }

    if (cleanHost.startsWith('wss://')) cleanHost = cleanHost.substring(6);
    else if (cleanHost.startsWith('ws://')) cleanHost = cleanHost.substring(5);
    else if (cleanHost.startsWith('https://')) cleanHost = cleanHost.substring(8);
    else if (cleanHost.startsWith('http://')) cleanHost = cleanHost.substring(7);

    cleanHost = cleanHost.split(':')[0].replace(/\/+$/, '');
    this.host = cleanHost;

    this.saveConfig();
    this.errorDismissed.set(false);
    await this.ss.connect(
      { host: this.host, port: this.port, username: this.username, password: this.password },
      this.vncContainer.nativeElement
    );
  }

  disconnect(): void {
    if (this.isRotated()) {
      this.isRotated.set(false);
      this.clearRotationStyles();
    }
    this.ss.disconnect();
  }

  dismissError(): void {
    this.errorDismissed.set(true);
  }

  @HostListener('window:resize')
  @HostListener('window:orientationchange')
  handleResize(): void {
    if (this.isConnected()) {
      setTimeout(() => {
        if (this.isRotated()) {
          this.applyRotationStyles();
        } else {
          this.ss.recalculateScaling();
        }
      }, 100);
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    if (document.fullscreenElement) {
      // ── Entering fullscreen ──────────────────────────────────────────────
      if (this.mobileQuery.matches && !this.isRotated()) {
        // Mobile only: auto-rotate if not already rotated.
        this.autoRotatedForFullscreen = true;
        this.isRotated.set(true);
        setTimeout(() => this.applyRotationStyles(), 150);
      } else {
        // Already rotated (any device) or desktop — just re-fit dimensions.
        setTimeout(() => {
          if (this.isRotated()) this.applyRotationStyles();
          else this.ss.recalculateScaling();
        }, 150);
      }
    } else {
      // ── Exiting fullscreen ───────────────────────────────────────────────
      if (this.autoRotatedForFullscreen) {
        // Undo the auto-rotation that fullscreen applied.
        this.autoRotatedForFullscreen = false;
        this.isRotated.set(false);
        this.clearRotationStyles();
        this.ss.recalculateScaling();
      } else {
        setTimeout(() => {
          if (this.isRotated()) this.applyRotationStyles();
          else this.ss.recalculateScaling();
        }, 150);
      }
    }
  }

  toggleRotate(): void {
    this.isRotated.update(v => !v);
    setTimeout(() => {
      if (this.isRotated()) {
        this.applyRotationStyles();
      } else {
        this.clearRotationStyles();
        this.ss.recalculateScaling();
      }
    }, 50);
  }

  private applyRotationStyles(): void {
    const container = this.vncContainer?.nativeElement;
    if (!container) return;
    const parent = container.parentElement!;

    // When rotated, the element's layout box extends outside the parent bounds
    // (negative left offset). Allow it — the *visual* result (post-transform)
    // still fits inside. The ancestor main-layout provides the outer clip.
    parent.style.overflow = 'visible';

    // In fullscreen, window.inner* gives the settled viewport size immediately;
    // parent.clientWidth/Height may not have updated yet when this runs.
    const inFullscreen = !!document.fullscreenElement;
    const pw = inFullscreen ? window.innerWidth  : parent.clientWidth;
    const ph = inFullscreen ? window.innerHeight : parent.clientHeight;

    container.style.position       = 'absolute';
    container.style.width          = ph + 'px';
    container.style.height         = pw + 'px';
    container.style.top            = ((ph - pw) / 2) + 'px';
    container.style.left           = ((pw - ph) / 2) + 'px';
    container.style.transformOrigin = 'center center';
    container.style.transform      = 'rotate(90deg)';
    this.ss.recalculateScaling();
  }

  private clearRotationStyles(): void {
    const container = this.vncContainer?.nativeElement;
    if (!container) return;
    // Restore the parent's overflow before clearing container styles.
    if (container.parentElement) {
      container.parentElement.style.overflow = '';
    }
    container.style.position       = '';
    container.style.width          = '';
    container.style.height         = '';
    container.style.top            = '';
    container.style.left           = '';
    container.style.transform      = '';
  }

  toggleFullscreen(): void {
    const container = this.vncContainer?.nativeElement;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      // Fullscreen the *parent* (viewer-area) so the vncContainer's rotation
      // styles remain relative to a stable parent element throughout.
      (container.parentElement ?? container).requestFullscreen();
    }
  }

  copyCommand(event: Event, platform: 'macos' | 'windows'): void {
    event.preventDefault();
    const commands: Record<string, string> = {
      macos: 'curl -fsSL https://raw.githubusercontent.com/publichomepage/claw-connect/main/install.sh | bash',
      windows: 'irm https://raw.githubusercontent.com/publichomepage/claw-connect/main/install.ps1 | iex',
    };
    navigator.clipboard.writeText(commands[platform]).then(() => {
      this.copiedCommand.set(platform);
      setTimeout(() => this.copiedCommand.set(null), 2000);
    });
  }

  saveConfig(): void {
    localStorage.setItem('clawconnect_screenshare', JSON.stringify({
      host: this.host,
      port: this.port,
      username: this.username,
    }));
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('clawconnect_screenshare');
      if (stored) {
        const config = JSON.parse(stored);
        this.host = config.host || '';
        this.port = config.port || 6080;
        this.username = config.username || '';

        if (location.protocol === 'https:' && this.port === 6080) {
          this.port = 443;
        }
      }
    } catch { }
  }
}
