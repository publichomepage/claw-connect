import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, OnDestroy, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OpenClawService, ConnectionConfig } from '../../services/openclaw.service';
import { MessageComponent } from '../message/message.component';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageComponent, SettingsComponent],
  template: `
    <div class="chat-container">
      <!-- Header -->
      <div class="chat-header">
        <div class="header-left">
          <span class="logo">🦞</span>
          <div class="header-info">
            <h1 class="header-title">ClawConnect</h1>
          </div>
        </div>
        <div class="header-right">
          <div class="connection-status" [class]="'status-' + openClaw.connectionStatus()">
            <span class="status-dot"></span>
            <span class="status-text">{{ getStatusText() }}</span>
          </div>
        </div>
      </div>

      <!-- Settings -->
      <div class="settings-wrapper">
        <app-settings
          (connectRequest)="onConnect($event)"
          (disconnectRequest)="onDisconnect()"
        />
      </div>

      <!-- Messages -->
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

      <!-- Input -->
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
  `,
  styles: [`
    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px 20px 20px;
    }

    /* Header */
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

    .header-info {
      display: flex;
      flex-direction: column;
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

    .header-subtitle {
      font-size: 11px;
      color: #666;
      letter-spacing: 0.5px;
    }

    .header-right {
      display: flex;
      align-items: center;
    }

    /* Connection Status */
    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transition: background 0.3s;
    }

    .status-connected .status-dot {
      background: #4CAF50;
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
      animation: statusGlow 2s infinite;
    }

    .status-connecting .status-dot {
      background: #FF9800;
      animation: statusPulse 1s infinite;
    }

    .status-disconnected .status-dot {
      background: #666;
    }

    .status-error .status-dot {
      background: #f44336;
      box-shadow: 0 0 8px rgba(244, 67, 54, 0.6);
    }

    .status-text {
      color: #888;
    }

    @keyframes statusGlow {
      0%, 100% { box-shadow: 0 0 4px rgba(76, 175, 80, 0.4); }
      50% { box-shadow: 0 0 12px rgba(76, 175, 80, 0.8); }
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Settings Wrapper */
    .settings-wrapper {
      margin-bottom: 12px;
    }

    /* Messages Area */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      margin-bottom: 12px;
      scroll-behavior: smooth;
    }

    .messages-area::-webkit-scrollbar {
      width: 6px;
    }

    .messages-area::-webkit-scrollbar-track {
      background: transparent;
    }

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
      color: #e0e0e0;
      margin: 0 0 10px;
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

    .typing-avatar {
      font-size: 18px;
    }

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
      padding: 4px 0 0;
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-wrapper:focus-within {
      border-color: rgba(255, 69, 0, 0.4);
      box-shadow: 0 0 0 3px rgba(255, 69, 0, 0.08);
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

    .input-wrapper textarea::placeholder {
      color: #555;
    }

    .input-wrapper textarea:disabled {
      opacity: 0.4;
    }

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

    .send-button:active:not(:disabled) {
      transform: scale(0.95);
    }

    .send-button:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .chat-container {
        padding: 10px;
      }

      .chat-header {
        padding: 12px 16px;
        border-radius: 16px;
      }

      .header-title {
        font-size: 18px;
      }

      .messages-area {
        padding: 12px;
        border-radius: 16px;
      }
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef<HTMLTextAreaElement>;

  inputText = '';
  private shouldScroll = true;

  constructor(public openClaw: OpenClawService) {
    // Auto-scroll when new messages arrive
    effect(() => {
      const msgs = this.openClaw.messages();
      if (msgs.length > 0) {
        this.shouldScroll = true;
      }
    });
  }

  ngOnInit(): void {
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
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
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
