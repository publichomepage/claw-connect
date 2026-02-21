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
        <span class="settings-title">Chat Settings</span>
        <button class="eye-btn" type="button" (click)="$event.stopPropagation(); showAll.set(!showAll())" tabindex="-1" title="Show/hide values">
          @if (showAll()) {
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          }
        </button>
        <span class="settings-chevron" [class.rotated]="isOpen()">›</span>
      </div>

      @if (isOpen()) {
        <div class="settings-body">
            <div class="field-row">
              <div class="field host-field">
                <label for="gateway-host">Gateway Host</label>
                <input
                  [type]="showAll() ? 'text' : 'password'"
                  id="gateway-host"
                  [(ngModel)]="gatewayHost"
                  (ngModelChange)="onHostChange($event)"
                  placeholder="localhost or tailscale-domain"
                />
              </div>
              <div class="field port-field">
                <label for="gateway-port">Gateway Port</label>
                <input
                  [type]="showAll() ? 'text' : 'password'"
                  id="gateway-port"
                  [(ngModel)]="gatewayPort"
                  (change)="saveToStorage()"
                />
              </div>
            </div>

            <div class="field">
              <label for="auth-token">Auth Token</label>
              <input
                [type]="showAll() ? 'text' : 'password'"
                id="auth-token"
                [(ngModel)]="authToken"
                placeholder="Enter gateway auth token"
                (change)="saveToStorage()"
              />
            </div>

          <div class="field">
            <label for="auth-password">Auth Password (optional)</label>
            <input
              [type]="showAll() ? 'text' : 'password'"
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

    .field-row {
      display: flex;
      gap: 12px;
    }

    .host-field {
      flex: 3;
    }

    .port-field {
      flex: 1;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px !important;
      font-weight: 500 !important;
      color: #e0e0e0 !important;
      text-transform: none !important;
      letter-spacing: normal !important;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: #FF4500;
      cursor: pointer;
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
  @Output() hostChange = new EventEmitter<string>();

  isOpen = signal(false);
  showAll = signal(false);

  gatewayHost = 'localhost';
  gatewayPort = 18789;
  authToken = '';
  authPassword = '';

  constructor() {
    this.loadFromStorage();
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  onHostChange(newHost: string): void {
    this.hostChange.emit(newHost);
  }

  onConnect(): void {
    this.saveToStorage();

    let cleanHost = this.gatewayHost.trim();
    if (cleanHost.startsWith('wss://')) cleanHost = cleanHost.substring(6);
    else if (cleanHost.startsWith('ws://')) cleanHost = cleanHost.substring(5);
    else if (cleanHost.startsWith('https://')) cleanHost = cleanHost.substring(8);
    else if (cleanHost.startsWith('http://')) cleanHost = cleanHost.substring(7);
    if (cleanHost.endsWith('/')) cleanHost = cleanHost.slice(0, -1);

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const finalUrl = `${protocol}://${cleanHost}:${this.gatewayPort}`;

    this.connectRequest.emit({
      url: finalUrl,
      authToken: this.authToken || undefined,
      authPassword: this.authPassword || undefined,
    });
  }

  onDisconnect(): void {
    this.disconnectRequest.emit();
  }

  saveToStorage(): void {
    localStorage.setItem('clawconnect_config', JSON.stringify({
      host: this.gatewayHost,
      port: this.gatewayPort,
      authToken: this.authToken,
    }));
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('clawconnect_config');
      if (stored) {
        const config = JSON.parse(stored);
        this.gatewayHost = config.host || 'localhost';
        this.gatewayPort = config.port || 18789;

        // Auto-migrate old WSS settings to new port routing if applicable
        if (location.protocol === 'https:' && this.gatewayPort === 18789) {
          this.gatewayPort = 8443;
        }

        this.authToken = config.authToken || '';
        this.authPassword = config.authPassword || '';
      } else {
        // Apply secure default out of the box
        if (location.protocol === 'https:') {
          this.gatewayPort = 8443;
        }
      }
    } catch {
      // Use defaults
      if (location.protocol === 'https:') {
        this.gatewayPort = 8443;
      }
    }
  }
}
