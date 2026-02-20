import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../services/openclaw.service';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="message-wrapper" [class]="'message-' + message.role">
      <div class="message-avatar">
        <span class="avatar-icon">{{ message.role === 'user' ? '👤' : message.role === 'system' ? '⚠️' : '🦞' }}</span>
      </div>
      <div class="message-bubble">
        <div class="message-header">
          <span class="message-sender">{{ getSenderName() }}</span>
          <span class="message-time">{{ formatTime(message.timestamp) }}</span>
        </div>
        <div class="message-content" [innerHTML]="formatContent(message.content)"></div>
        @if (message.isStreaming) {
          <div class="streaming-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .message-wrapper {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      animation: messageSlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes messageSlideIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-user {
      flex-direction: row-reverse;
    }

    .message-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .avatar-icon {
      font-size: 18px;
    }

    .message-bubble {
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 16px;
      position: relative;
    }

    .message-user .message-bubble {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px 16px 4px 16px;
      color: #e0e0e0;
    }

    .message-assistant .message-bubble {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(8px);
      border-radius: 16px 16px 16px 4px;
      color: #e0e0e0;
    }

    .message-system .message-bubble {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.2);
      border-radius: 12px;
      color: #FFB74D;
      max-width: 100%;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .message-sender {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
    }

    .message-time {
      font-size: 10px;
      opacity: 0.5;
    }

    .message-content {
      font-size: 14px;
      line-height: 1.6;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .message-content :global(code) {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }

    .message-content :global(pre) {
      background: rgba(0, 0, 0, 0.4);
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;
    }

    .streaming-indicator {
      display: flex;
      gap: 4px;
      padding-top: 6px;
    }

    .streaming-indicator .dot {
      width: 6px;
      height: 6px;
      background: #FF4500;
      border-radius: 50%;
      animation: dotPulse 1.4s infinite ease-in-out both;
    }

    .streaming-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
    .streaming-indicator .dot:nth-child(2) { animation-delay: -0.16s; }
    .streaming-indicator .dot:nth-child(3) { animation-delay: 0; }

    @keyframes dotPulse {
      0%, 80%, 100% {
        transform: scale(0.6);
        opacity: 0.4;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `]
})
export class MessageComponent {
  @Input({ required: true }) message!: ChatMessage;

  getSenderName(): string {
    switch (this.message.role) {
      case 'user': return 'You';
      case 'assistant': return 'OpenClaw';
      case 'system': return 'System';
      default: return 'Unknown';
    }
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatContent(content: string): string {
    // Basic markdown-like formatting
    let formatted = this.escapeHtml(content);

    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g,
      '<pre><code>$2</code></pre>');
    formatted = formatted.replace(/```([\s\S]*?)```/g,
      '<pre><code>$1</code></pre>');

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g,
      '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return formatted;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
