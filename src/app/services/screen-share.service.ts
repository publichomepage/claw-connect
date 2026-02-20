import { Injectable, signal } from '@angular/core';

export type ScreenShareStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable({
    providedIn: 'root'
})
export class ScreenShareService {
    status = signal<ScreenShareStatus>('disconnected');
    errorMessage = signal<string>('');

    updateStatus(newStatus: ScreenShareStatus, error: string = ''): void {
        this.status.set(newStatus);
        this.errorMessage.set(error);
    }

    setConnected(connected: boolean): void {
        this.status.set(connected ? 'connected' : 'disconnected');
    }

    setConnecting(connecting: boolean): void {
        if (connecting) {
            this.status.set('connecting');
        } else if (this.status() === 'connecting') {
            this.status.set('disconnected');
        }
    }

    setError(message: string): void {
        this.status.set('error');
        this.errorMessage.set(message);
    }
}
