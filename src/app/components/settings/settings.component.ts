import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConnectionConfig } from '../../services/openclaw.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-panel" [class.open]="isOpen()">
      <div class="settings-header" (click)="toggle()">
        <span class="settings-icon">⚙️</span>
        <span class="settings-title">Connection Settings</span>
        <span class="settings-chevron" [class.rotated]="isOpen()">›</span>
      </div>

      @if (isOpen()) {
        <div class="settings-body">
          <div class="field">
            <label for="gateway-url">Gateway URL</label>
            <input
              type="text"
              id="gateway-url"
              [(ngModel)]="gatewayUrl"
              placeholder="ws://localhost:18789"
              (change)="saveToStorage()"
            />
          </div>

          <div class="field">
            <label for="auth-token">Auth Token</label>
            <input
              type="password"
              id="auth-token"
              [(ngModel)]="authToken"
              placeholder="Enter gateway auth token"
              (change)="saveToStorage()"
            />
          </div>

          <div class="field">
            <label for="auth-password">Auth Password (optional)</label>
            <input
              type="password"
              id="auth-password"
              [(ngModel)]="authPassword"
              placeholder="Enter gateway password"
              (change)="saveToStorage()"
            />
          </div>

          <div class="settings-actions">
            <button class="btn btn-primary" (click)="onConnect()">
              Connect
            </button>
            <button class="btn btn-secondary" (click)="onDisconnect()">
              Disconnect
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-panel {
      background: transparent;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .settings-panel.open {
      background: rgba(255, 255, 255, 0.02);
      border-bottom-color: rgba(255, 69, 0, 0.2);
    }

    .settings-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s;
    }

    .settings-header:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    .settings-icon {
      font-size: 16px;
    }

    .settings-title {
      font-size: 13px;
      font-weight: 600;
      color: #b0b0b0;
      letter-spacing: 0.3px;
      flex: 1;
    }

    .settings-chevron {
      font-size: 18px;
      color: #666;
      transition: transform 0.3s;
    }

    .settings-chevron.rotated {
      transform: rotate(90deg);
    }

    .settings-body {
      padding: 0 20px 20px;
      animation: settingsExpand 0.3s ease;
    }

    @keyframes settingsExpand {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .field {
      margin-bottom: 14px;
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

    .settings-actions {
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
    }

    .btn-primary {
      background: linear-gradient(135deg, #FF4500, #E63E00);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(255, 69, 0, 0.3);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #b0b0b0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #e0e0e0;
    }
  `]
})
export class SettingsComponent {
  @Output() connectRequest = new EventEmitter<ConnectionConfig>();
  @Output() disconnectRequest = new EventEmitter<void>();

  isOpen = signal(false);
  gatewayUrl = 'ws://localhost:18789';
  authToken = '';
  authPassword = '';

  constructor() {
    this.loadFromStorage();
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  onConnect(): void {
    this.saveToStorage();
    this.connectRequest.emit({
      url: this.gatewayUrl,
      authToken: this.authToken || undefined,
      authPassword: this.authPassword || undefined,
    });
  }

  onDisconnect(): void {
    this.disconnectRequest.emit();
  }

  saveToStorage(): void {
    localStorage.setItem('clawconnect_config', JSON.stringify({
      url: this.gatewayUrl,
      authToken: this.authToken,
      authPassword: this.authPassword,
    }));
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('clawconnect_config');
      if (stored) {
        const config = JSON.parse(stored);
        this.gatewayUrl = config.url || 'ws://localhost:18789';
        this.authToken = config.authToken || '';
        this.authPassword = config.authPassword || '';
      }
    } catch {
      // Use defaults
    }
  }
}
