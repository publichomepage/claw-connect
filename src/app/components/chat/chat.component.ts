import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, OnDestroy, effect, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OpenClawService, ConnectionConfig } from '../../services/openclaw.service';
import { MessageComponent } from '../message/message.component';
import { SettingsComponent } from '../settings/settings.component';
import { ScreenShareComponent } from '../screen-share/screen-share.component';
import { ScreenShareService } from '../../services/screen-share.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageComponent, SettingsComponent, ScreenShareComponent],
  template: `
    <div class="app-shell">
      <!-- Header -->
      <div class="chat-header">
        <div class="header-left">
          <span class="logo">🦞</span>
          <div class="header-info">
            <h1 class="header-title">ClawConnect</h1>
          </div>
        </div>
        <div class="header-right">
          <!-- Connection status moved to Chat panel -->
        </div>
      </div>

      <!-- Mobile Tab Bar (only visible on mobile) -->
      @if (isMobile()) {
        <div class="tab-bar">
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'chat'"
            (click)="activeTab.set('chat')"
          >
            <span class="tab-icon">💬</span>
            <span>Chat</span>
            <span class="status-dot mini" [class]="'status-' + openClaw.connectionStatus()"></span>
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'screen'"
            (click)="activeTab.set('screen')"
          >
            <span class="tab-icon">🖥️</span>
            <span>Screen Share</span>
            <span class="status-dot mini" [class]="'status-' + ss.status()"></span>
          </button>
        </div>
      }

      <!--
        Unified main layout for both mobile and desktop.
        panel-offscreen (not [hidden]/display:none) is used so the VNC canvas
        always has real dimensions — display:none would collapse it to 0×0 and
        cause noVNC to drop the connection on every layout switch.
      -->
      <div class="main-layout"
           [class.is-mobile]="isMobile()"
           [class.layout-split]="!isMobile() && desktopLayout() === 'split'"
           [class.layout-chat-full]="!isMobile() && desktopLayout() === 'chat-full'"
           [class.layout-screen-full]="!isMobile() && desktopLayout() === 'screen-full'">

        <!-- Chat Panel -->
        <div class="panel chat-panel"
             [class.panel-inactive]="isMobile() && activeTab() !== 'chat'"
             [class.collapsed]="!isMobile() && desktopLayout() === 'screen-full'">

          <!-- Desktop collapsed strip (screen-full mode) -->
          <div class="panel-strip"
               [hidden]="isMobile() || desktopLayout() !== 'screen-full'"
               (click)="desktopLayout.set('split')">
            <span class="strip-icon">💬</span>
            <span class="strip-label">Chat</span>
            <span class="status-dot mini strip-dot" [class]="'status-' + openClaw.connectionStatus()"></span>
          </div>

          <!-- Chat content -->
          <div class="panel-content"
               [hidden]="!isMobile() && desktopLayout() === 'screen-full'">
            @if (!isMobile()) {
              <div class="panel-header-mini">
                <span class="panel-icon">💬</span>
                <span class="panel-title">Chat</span>
                <span class="status-dot mini" [class]="'status-' + openClaw.connectionStatus()"></span>
              </div>
            }
            <div class="settings-wrapper">
              <app-settings
                (connectRequest)="onConnect($event)"
                (disconnectRequest)="onDisconnect()"
                (hostChange)="onGatewayHostChange($event)"
              />
            </div>

            @if (openClaw.connectionStatus() === 'error') {
              <div class="connection-error-banner">
                <span class="error-icon">⚠️</span>
                <div class="error-text">
                  <strong>Connection Failed</strong>
                  <span>Could not connect to the OpenClaw Gateway. Please check your settings and ensure the Gateway is running.</span>
                </div>
              </div>
            }

            <div class="messages-area" #messagesContainer>
              @if (openClaw.messages().length === 0) {
                <div class="empty-state">
                  <div class="empty-icon">🦞</div>
                  <h2 class="empty-title">Welcome to ClawConnect</h2>
                  <p class="empty-description">
                    @if (openClaw.isConnected()) {
                      Your OpenClaw Gateway is connected. Start chatting!
                    } @else {
                      Connect to your OpenClaw Gateway to start chatting.
                      <br />Configure your Gateway URL in Settings above.
                      @if (!isMobile()) {
                        <div class="prereqs">
                          <div class="prereq-title">Prerequisites:</div>
                          <div class="prereq-item">
                            <span class="prereq-bullet">1</span>
                            <span class="prereq-text">Run <strong><code>npm run setup</code></strong> to auto-configure CORS and auth.</span>
                          </div>
                        </div>
                      }
                    }
                  </p>
                </div>
              }
              @for (message of openClaw.messages(); track message.id) {
                <app-message [message]="message" />
              }
              @if (openClaw.isTyping()) {
                <div class="typing-indicator">
                  <span class="typing-avatar">🦞</span>
                  <div class="typing-dots">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                  </div>
                </div>
              }
            </div>
            <div class="input-area">
              <div class="input-wrapper">
                <textarea
                  #messageInput
                  [(ngModel)]="inputText"
                  placeholder="{{ openClaw.isConnected() ? 'Type a message...' : 'Connect to Gateway first...' }}"
                  [disabled]="!openClaw.isConnected()"
                  (keydown)="handleKeyDown($event)"
                  rows="1"
                  (input)="autoResize($event)"
                ></textarea>
                <button
                  class="send-button"
                  [disabled]="!openClaw.isConnected() || !inputText.trim()"
                  (click)="sendMessage()"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Divider (desktop split mode only) -->
        @if (!isMobile() && desktopLayout() === 'split') {
          <div class="panel-divider">
            <button class="divider-btn left" (click)="desktopLayout.set('screen-full')" title="Expand Screen Share">❮</button>
            <div class="divider-handle"></div>
            <button class="divider-btn right" (click)="desktopLayout.set('chat-full')" title="Expand Chat">❯</button>
          </div>
        }

        <!-- Screen Share Panel -->
        <div class="panel screen-panel"
             [class.panel-inactive]="isMobile() && activeTab() !== 'screen'"
             [class.collapsed]="!isMobile() && desktopLayout() === 'chat-full'">

          <!-- Desktop collapsed strip (chat-full mode) -->
          <div class="panel-strip"
               [hidden]="isMobile() || desktopLayout() !== 'chat-full'"
               (click)="desktopLayout.set('split')">
            <span class="strip-icon">🖥️</span>
            <span class="strip-label">Screen</span>
            <span class="status-dot mini strip-dot" [class]="'status-' + ss.status()"></span>
          </div>

          <!-- Screen share content — always kept in DOM to preserve VNC connection -->
          <div class="panel-content"
               [hidden]="!isMobile() && desktopLayout() === 'chat-full'">
            @if (!isMobile()) {
              <div class="panel-header-mini">
                <span class="panel-icon">🖥️</span>
                <span class="panel-title">Screen Share</span>
                <span class="status-dot mini" [class]="'status-' + ss.status()"></span>
              </div>
            }
            <app-screen-share />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ==============================
       App Shell
       ============================== */
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 20px;
      max-width: 100%;
      box-sizing: border-box;
    }

    /* ==============================
       Header
       ============================== */
    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      margin-bottom: 12px;
      backdrop-filter: blur(20px);
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo {
      font-size: 32px;
      filter: drop-shadow(0 0 8px rgba(255, 69, 0, 0.4));
    }

    .header-title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
      background: linear-gradient(135deg, #FF4500, #FF6B35);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-right {
      display: flex;
      align-items: center;
    }

    /* Connection Status */
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transition: background 0.3s;
    }

    .status-dot.status-connected {
      background: #4CAF50;
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
      animation: statusGlow 2s infinite;
    }

    .status-dot.status-connecting {
      background: #FF9800;
      animation: statusPulse 1s infinite;
    }

    .status-dot.status-disconnected { background: #666; }

    .status-dot.status-error {
      background: #f44336;
      box-shadow: 0 0 8px rgba(244, 67, 54, 0.6);
    }

    @keyframes statusGlow {
      0%, 100% { box-shadow: 0 0 4px rgba(76, 175, 80, 0.4); }
      50% { box-shadow: 0 0 12px rgba(76, 175, 80, 0.8); }
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* ==============================
       Mobile Tab Bar
       ============================== */
    .tab-bar {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      margin-bottom: 12px;
      flex-shrink: 0;
    }

    .tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      background: transparent;
      border: none;
      border-radius: 12px;
      color: #888;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .tab-btn:hover { background: rgba(255, 255, 255, 0.05); color: #bbb; }

    .tab-btn.active {
      background: rgba(255, 69, 0, 0.12);
      color: #FF6B35;
      box-shadow: 0 2px 8px rgba(255, 69, 0, 0.1);
    }

    .tab-icon { font-size: 15px; }

    /* Ensure [hidden] always wins over display classes */
    [hidden] { display: none !important; }

    /* ==============================
       Unified Main Layout
       ============================== */
    .main-layout {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden; /* clips the off-screen panel-inactive slide */
      position: relative; /* establishes stacking context for absolute-positioned panels */
    }

    /*
     * Mobile layout: both panels are absolutely positioned and fill the full
     * layout area at all times — they always have real, non-zero dimensions.
     *
     * The inactive panel is pushed off-screen with CSS transform. Unlike
     * display:none or visibility:hidden, transform is a pure rendering
     * operation: offsetWidth/offsetHeight are unchanged, the canvas context is
     * never disturbed, and noVNC's ResizeObserver never fires. This mirrors
     * how OpenClawService's WebSocket stays alive — the connection is
     * completely decoupled from anything that could affect DOM dimensions.
     */
    .main-layout.is-mobile .panel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    .main-layout.is-mobile .panel.panel-inactive {
      transform: translateX(100%);
      pointer-events: none;
    }

    /* Desktop layout modes */
    .main-layout.layout-split .chat-panel { flex: 55; }
    .main-layout.layout-split .screen-panel { flex: 45; }

    .main-layout.layout-chat-full .chat-panel { flex: 1; }
    .main-layout.layout-chat-full .screen-panel { flex: 0 0 48px; }

    .main-layout.layout-screen-full .chat-panel { flex: 0 0 48px; }
    .main-layout.layout-screen-full .screen-panel { flex: 1; }

    /* Panels */
    .panel {
      display: flex;
      position: relative;
      transition: flex 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      min-width: 0;
      overflow: hidden;
    }

    .panel-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    /* Collapsed sidebar strip */
    .panel.collapsed {
      flex: 0 0 48px;
    }

    .panel-strip {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 48px;
      height: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s;
      user-select: none;
    }

    .panel-strip:hover {
      background: rgba(255, 69, 0, 0.08);
      border-color: rgba(255, 69, 0, 0.2);
    }

    .strip-icon {
      font-size: 20px;
    }

    .strip-label {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 11px;
      font-weight: 600;
      color: #888;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Panel divider */
    .panel-divider {
      width: 40px;
      margin: 12px -20px; /* Overlap slightly for better hit area */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 20;
      position: relative;
      flex-shrink: 0;
    }

    .divider-handle {
      width: 4px;
      height: 60px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      transition: background 0.3s;
    }
 
    .panel-divider:hover .divider-handle {
      background: rgba(255, 69, 0, 0.6);
    }

    .divider-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #999;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      padding: 0;
      backdrop-filter: blur(4px);
    }

    .divider-btn:hover {
      background: rgba(255, 69, 0, 0.15);
      border-color: rgba(255, 69, 0, 0.3);
      color: #FF6B35;
      transform: scale(1.1);
    }

    .divider-btn.left { margin-right: 0; }
    .divider-btn.right { margin-left: 0; }

    /* Edge expand/collapse buttons removed in favor of divider controls */

    /* ==============================
       Shared Content Styles
       ============================== */
    .panel-header-mini {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 20px;
      background: transparent;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .panel-icon {
      font-size: 14px;
      opacity: 0.8;
    }

    .panel-title {
      font-size: 12px;
      font-weight: 600;
      color: #bbb;
      letter-spacing: 0.5px;
    }

    .status-dot.mini {
      width: 8px;
      height: 8px;
    }

    .strip-dot {
      margin-top: 4px;
    }

    .settings-wrapper {
      margin-bottom: 0;
      flex-shrink: 0;
    }

    /* Connection Error Banner */
    .connection-error-banner {
      margin: 12px 20px 0;
      padding: 12px 16px;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: bannerSlideDown 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      flex-shrink: 0;
    }

    @keyframes bannerSlideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .error-icon {
      font-size: 20px;
    }

    .error-text {
      display: flex;
      flex-direction: column;
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
    }

    /* Messages Area */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: transparent;
      scroll-behavior: smooth;
      min-height: 0;
    }

    .messages-area::-webkit-scrollbar { width: 6px; }
    .messages-area::-webkit-scrollbar-track { background: transparent; }
    .messages-area::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    .messages-area::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      padding: 40px 20px;
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: lobsterFloat 3s ease-in-out infinite;
    }

    @keyframes lobsterFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    .empty-title {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }

    .empty-description {
      font-size: 15px;
      color: #bbb;
      line-height: 1.6;
      max-width: 400px;
    }

    /* Prerequisites Box */
    .prereqs {
      text-align: left;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      margin-top: 24px;
      width: 100%;
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

    .empty-description {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
      max-width: 400px;
    }

    /* Typing Indicator */
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
      animation: messageSlideIn 0.3s ease;
    }

    @keyframes messageSlideIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .typing-avatar { font-size: 18px; }

    .typing-dots {
      display: flex;
      gap: 4px;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.07);
      border-radius: 16px;
    }

    .typing-dots .dot {
      width: 8px;
      height: 8px;
      background: #FF4500;
      border-radius: 50%;
      animation: typingBounce 1.4s infinite ease-in-out both;
    }

    .typing-dots .dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dots .dot:nth-child(2) { animation-delay: -0.16s; }
    .typing-dots .dot:nth-child(3) { animation-delay: 0; }

    @keyframes typingBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Input Area */
    .input-area {
      padding: 0;
      flex-shrink: 0;
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      padding: 16px 20px;
      background: transparent;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      transition: background 0.2s;
    }

    .input-wrapper:focus-within {
      background: rgba(255, 255, 255, 0.02);
    }

    .input-wrapper textarea {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e0e0e0;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      line-height: 1.5;
      resize: none;
      min-height: 24px;
      max-height: 120px;
    }

    .input-wrapper textarea::placeholder { color: #555; }
    .input-wrapper textarea:disabled { opacity: 0.4; }

    .send-button {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #FF4500, #E63E00);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    }

    .send-button:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(255, 69, 0, 0.35);
    }

    .send-button:active:not(:disabled) { transform: scale(0.95); }
    .send-button:disabled { opacity: 0.3; cursor: not-allowed; }

    /* ==============================
       Responsive
       ============================== */
    @media (max-width: 767px) {
      .app-shell {
        padding: 10px;
      }

      .chat-header {
        padding: 12px 16px;
        border-radius: 16px;
      }

      .header-title { font-size: 18px; }

      .messages-area {
        padding: 12px;
      }
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef<HTMLTextAreaElement>;

  inputText = '';
  activeTab = signal<'chat' | 'screen'>('chat');
  desktopLayout = signal<'split' | 'chat-full' | 'screen-full'>('split');
  isMobile = signal(false);
  private shouldScroll = true;
  private mediaQuery!: MediaQueryList;

  constructor(public openClaw: OpenClawService, public ss: ScreenShareService) {
    // Auto-scroll when new messages arrive
    effect(() => {
      const msgs = this.openClaw.messages();
      if (msgs.length > 0) {
        this.shouldScroll = true;
      }
    });
  }

  ngOnInit(): void {
    // Detect mobile vs desktop
    this.mediaQuery = window.matchMedia('(max-width: 767px)');
    this.isMobile.set(this.mediaQuery.matches);
    this.mediaQuery.addEventListener('change', this.onMediaChange);

    // Try auto-connecting with saved config
    const stored = localStorage.getItem('clawconnect_config');
    if (stored) {
      try {
        const config = JSON.parse(stored);
        if (config.url) {
          this.openClaw.connect({
            url: config.url,
            authToken: config.authToken || undefined,
            authPassword: config.authPassword || undefined,
          });
        }
      } catch {
        // Skip auto-connect
      }
    }
  }

  ngOnDestroy(): void {
    this.openClaw.disconnect();
    this.mediaQuery?.removeEventListener('change', this.onMediaChange);
  }

  private onMediaChange = (e: MediaQueryListEvent) => {
    // Switch to screen tab before marking mobile so the screen panel is never
    // hidden (display:none) while a VNC session is active. A hidden ancestor
    // collapses the canvas to 0×0, which causes noVNC to drop the connection.
    if (e.matches && this.ss.status() === 'connected') {
      this.activeTab.set('screen');
    }
    this.isMobile.set(e.matches);
  };

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onGatewayHostChange(newHost: string): void {
    this.ss.sharedHost.set(newHost);
  }

  onConnect(config: ConnectionConfig): void {
    this.openClaw.disconnect();
    this.openClaw.connect(config);
  }

  onDisconnect(): void {
    this.openClaw.disconnect();
  }

  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text || !this.openClaw.isConnected()) return;

    this.openClaw.sendMessage(text);
    this.inputText = '';

    // Reset textarea height
    if (this.messageInput) {
      this.messageInput.nativeElement.style.height = 'auto';
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  autoResize(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  getStatusText(): string {
    switch (this.openClaw.connectionStatus()) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
      default: return '';
    }
  }

  private scrollToBottom(): void {
    try {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch {
      // Ignore scroll errors
    }
  }
}
