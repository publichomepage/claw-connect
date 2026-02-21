import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ConnectionConfig {
  url: string;
  authToken?: string;
  authPassword?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// OpenClaw Gateway Protocol v3 frame types
interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: { code: string; message: string; details?: unknown };
}

interface EventFrame {
  type: 'event';
  event: string;
  payload?: any;
  seq?: number;
}

type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

const PROTOCOL_VERSION = 3;

@Injectable({ providedIn: 'root' })
export class OpenClawService {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private config: ConnectionConfig | null = null;
  private handshakeComplete = false;
  private sessionKey = '';

  readonly connectionStatus = signal<ConnectionStatus>('disconnected');
  readonly messages = signal<ChatMessage[]>([]);
  readonly isTyping = signal(false);

  private incomingMessage$ = new Subject<ChatMessage>();
  readonly onMessage = this.incomingMessage$.asObservable();

  readonly isConnected = computed(() => this.connectionStatus() === 'connected');

  connect(config: ConnectionConfig): void {
    this.config = config;
    this.connectionStatus.set('connecting');
    this.reconnectAttempts = 0;
    this.handshakeComplete = false;
    this.establishConnection();
  }

  private nextId(): string {
    return `clawconnect-${++this.requestId}-${Date.now()}`;
  }

  private establishConnection(): void {
    if (!this.config) return;

    // Track whether onerror fired so onclose can preserve the error state.
    // WebSocket always fires onerror THEN onclose — without this flag the
    // onclose handler would immediately overwrite 'error' with 'disconnected',
    // hiding the error banner from the user.
    let hadError = false;

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        hadError = false;
        // Don't set 'connected' yet — wait for handshake
        // Server will send a connect.challenge event first
      };

      this.ws.onmessage = (event) => {
        this.handleFrame(event.data);
      };

      this.ws.onclose = (event) => {
        this.handshakeComplete = false;
        this.isTyping.set(false);
        this.messages.update(msgs => msgs.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));

        if (hadError) {
          // onerror already set 'error' — keep it visible
          this.connectionStatus.set('error');
        } else {
          this.connectionStatus.set('disconnected');
        }

        if (!event.wasClean && this.config) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        hadError = true;
        this.connectionStatus.set('error');
        this.isTyping.set(false);
        this.messages.update(msgs => msgs.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
      };
    } catch (error) {
      this.connectionStatus.set('error');
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionStatus.set('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimer = setTimeout(() => {
      if (this.connectionStatus() !== 'connected') {
        this.connectionStatus.set('connecting');
        this.establishConnection();
      }
    }, delay);
  }

  private handleFrame(data: string): void {
    try {
      const frame: GatewayFrame = JSON.parse(data);

      switch (frame.type) {
        case 'event':
          this.handleEvent(frame);
          break;
        case 'res':
          this.handleResponse(frame);
          break;
        case 'req':
          // Server-initiated requests (rare for webchat client)
          break;
      }
    } catch {
      // Non-JSON message, ignore
    }
  }

  private handleEvent(frame: EventFrame): void {
    switch (frame.event) {
      case 'connect.challenge':
        // Server sent challenge — respond with connect handshake
        this.sendConnectHandshake();
        break;

      case 'chat':
      case 'chat.message':
        // New chat message from the agent
        if (frame.payload) {
          this.handleChatEvent(frame.payload);
        }
        break;

      case 'chat.stream':
        if (frame.payload) {
          this.handleStreamEvent(frame.payload);
        }
        break;

      case 'tick':
        // Heartbeat — ignore
        break;

      case 'shutdown':
        this.connectionStatus.set('disconnected');
        break;

      default:
        // Unknown event, check if it contains chat-like data
        break;
    }
  }

  private sendConnectHandshake(): void {
    if (!this.config || !this.ws) return;

    const connectFrame: RequestFrame = {
      type: 'req',
      id: this.nextId(),
      method: 'connect',
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: 'openclaw-control-ui',
          displayName: 'ClawConnect',
          version: '1.0.0',
          platform: 'web',
          mode: 'ui',
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: {
          token: this.config.authToken || undefined,
          password: this.config.authPassword || undefined,
        },
      },
    };

    // Track this as a pending request
    const frameId = connectFrame.id;
    const promise = new Promise<any>((resolve, reject) => {
      this.pendingRequests.set(frameId, { resolve, reject });
    });

    this.ws.send(JSON.stringify(connectFrame));

    promise.then(
      (result) => {
        this.handshakeComplete = true;
        this.connectionStatus.set('connected');
        this.reconnectAttempts = 0;

        // Extract sessionKey from the hello-ok snapshot
        if (result?.snapshot?.session?.mainSessionKey) {
          this.sessionKey = result.snapshot.session.mainSessionKey;
        } else if (result?.snapshot?.session?.mainKey) {
          this.sessionKey = result.snapshot.session.mainKey;
        } else {
          // Fallback: use a default session key
          this.sessionKey = 'main';
        }

        // Load chat history after successful connection
        this.loadHistory();
      },
      (error) => {
        this.connectionStatus.set('error');
        console.error('OpenClaw handshake failed:', error);
      }
    );
  }

  private handleResponse(frame: ResponseFrame): void {
    const pending = this.pendingRequests.get(frame.id);
    if (!pending) return;

    this.pendingRequests.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject(frame.error || { code: 'UNKNOWN', message: 'Unknown error' });
    }
  }

  private handleChatEvent(payload: any): void {
    // Chat events from OpenClaw have: runId, seq, state (delta|final|aborted|error), message
    const runId = payload.runId;
    const state: string = payload.state || 'final';
    const rawContent = payload.message?.content ?? payload.message ?? payload.content ?? '';
    const content = this.extractContent(rawContent);
    const role: 'user' | 'assistant' | 'system' = this.normalizeRole(payload.message?.role || payload.role || 'assistant');

    // Handle error state
    if (state === 'error') {
      const errorText = payload.errorMessage || 'An error occurred';
      this.isTyping.set(false);
      this.messages.update(msgs => {
        const newMsgs = [...msgs, {
          id: runId || crypto.randomUUID(),
          role: 'system' as const,
          content: `Error: ${errorText}`,
          timestamp: new Date(),
        }];
        return newMsgs.slice(-50);
      });
      return;
    }

    // Handle aborted state
    if (state === 'aborted') {
      this.isTyping.set(false);
      // Update existing streaming message to mark it as done
      if (runId) {
        this.messages.update(msgs =>
          msgs.map(m => m.id === runId ? { ...m, isStreaming: false } : m)
        );
      }
      return;
    }

    if (!content) return;

    const isDelta = state === 'delta';
    const isFinal = state === 'final';

    if (runId) {
      // Check if we already have a message for this runId
      const existing = this.messages().find(m => m.id === runId);

      if (existing) {
        // Update existing message in-place (streaming update)
        this.messages.update(msgs =>
          msgs.map(m => m.id === runId
            ? { ...m, content, isStreaming: isDelta }
            : m
          )
        );
      } else {
        // First delta for this runId — create the message
        this.messages.update(msgs => {
          const newMsgs = [...msgs, {
            id: runId,
            role,
            content,
            timestamp: new Date(),
            isStreaming: isDelta,
          }];
          return newMsgs.slice(-50);
        });
      }

      if (isFinal) {
        this.isTyping.set(false);
        const finalMsg = this.messages().find(m => m.id === runId);
        if (finalMsg) {
          this.incomingMessage$.next(finalMsg);
        }
      }
    } else {
      // No runId — treat as a one-shot message (e.g., from history or inject)
      this.isTyping.set(false);
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
      };
      this.messages.update(msgs => {
        const newMsgs = [...msgs, msg];
        return newMsgs.slice(-50);
      });
      this.incomingMessage$.next(msg);
    }
  }

  private handleStreamEvent(payload: any): void {
    const content = this.extractContent(payload.content || payload.text || payload.chunk || payload.delta || '');
    const messageId = payload.id || payload.messageId || 'streaming';
    const done = payload.done || payload.finished || payload.final;

    this.messages.update(msgs => {
      const existing = msgs.find(m => m.id === messageId && m.isStreaming);
      if (existing) {
        return msgs.map(m =>
          m.id === messageId
            ? { ...m, content: m.content + content, isStreaming: !done }
            : m
        );
      } else if (content) {
        const newMsgs = [...msgs, {
          id: messageId,
          role: 'assistant' as const,
          content,
          timestamp: new Date(),
          isStreaming: !done,
        }];
        return newMsgs.slice(-50);
      }
      return msgs;
    });

    if (done) {
      this.isTyping.set(false);
    }
  }

  /**
   * Extract text content from OpenClaw message content.
   * Content can be: a string, an array of content blocks [{type:'text', text:'...'}],
   * or a nested object with .text/.content/.message properties.
   */
  private extractContent(content: any): string {
    if (typeof content === 'string') return content;
    if (content === null || content === undefined) return '';

    // Array of content blocks (Anthropic/OpenAI format)
    if (Array.isArray(content)) {
      return content
        .map((block: any) => {
          if (typeof block === 'string') return block;
          if (block?.type === 'text' && typeof block?.text === 'string') return block.text;
          if (block?.type === 'tool_use') return `[Tool: ${block.name || 'unknown'}]`;
          if (block?.type === 'tool_result') {
            return this.extractContent(block.content);
          }
          if (typeof block?.text === 'string') return block.text;
          if (typeof block?.content === 'string') return block.content;
          if (typeof block?.message === 'string') return block.message;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }

    // Nested object
    if (typeof content === 'object') {
      if (typeof content.text === 'string') return content.text;
      if (typeof content.content === 'string') return content.content;
      if (typeof content.message === 'string') return content.message;
      // If it has content as array, recurse
      if (Array.isArray(content.content)) return this.extractContent(content.content);
      return '';
    }

    return String(content);
  }

  private normalizeRole(role: string): 'user' | 'assistant' | 'system' {
    if (!role) return 'assistant';
    const r = role.toLowerCase();
    if (r === 'user' || r === 'human') return 'user';
    if (r === 'system' || r === 'error') return 'system';
    return 'assistant';
  }

  private sendRequest(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.handshakeComplete) {
        reject(new Error('Not connected to Gateway'));
        return;
      }

      const frame: RequestFrame = {
        type: 'req',
        id: this.nextId(),
        method,
        params,
      };

      this.pendingRequests.set(frame.id, { resolve, reject });
      this.ws.send(JSON.stringify(frame));

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(frame.id)) {
          this.pendingRequests.delete(frame.id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async sendMessage(text: string): Promise<void> {
    // Add user message immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    this.messages.update(msgs => {
      const newMsgs = [...msgs, userMsg];
      return newMsgs.slice(-50);
    });
    this.isTyping.set(true);

    try {
      const result = await this.sendRequest('chat.send', {
        sessionKey: this.sessionKey,
        message: text,
        idempotencyKey: crypto.randomUUID(),
      });

      // If server responds with the assistant message directly in payload
      if (result && result.content) {
        const msg: ChatMessage = {
          id: result.id || crypto.randomUUID(),
          role: 'assistant' as const,
          content: result.content,
          timestamp: result.timestamp ? new Date(result.timestamp) : new Date(),
        };
        this.isTyping.set(false);
        this.messages.update(msgs => {
          const newMsgs = [...msgs, msg];
          return newMsgs.slice(-50);
        });
        this.incomingMessage$.next(msg);
      }
      // Otherwise, response will come via chat events
    } catch (error: any) {
      this.isTyping.set(false);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system' as const,
        content: `Error: ${error.message || 'Failed to send message'}`,
        timestamp: new Date(),
      };
      this.messages.update(msgs => {
        const newMsgs = [...msgs, errorMsg];
        return newMsgs.slice(-50);
      });
    }
  }

  async loadHistory(): Promise<void> {
    try {
      const result = await this.sendRequest('chat.history', {
        sessionKey: this.sessionKey,
        limit: 50,
      });
      if (!result) return;

      // chat.history returns an array of transcript entries
      const entries = Array.isArray(result) ? result
        : result.entries ? result.entries
          : result.messages ? result.messages
            : null;

      if (entries && Array.isArray(entries)) {
        let historyMessages: ChatMessage[] = entries
          .map((entry: any) => {
            const content = this.extractContent(entry.content ?? entry.text ?? entry.message ?? '');
            return {
              id: entry.id || crypto.randomUUID(),
              role: this.normalizeRole(entry.role || entry.sender),
              content,
              timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
            };
          })
          .filter((m: ChatMessage) => m.content.length > 0);

        // Local truncation fallback: take last 50
        if (historyMessages.length > 50) {
          historyMessages = historyMessages.slice(-50);
        }

        if (historyMessages.length > 0) {
          this.messages.set(historyMessages);
        }
      }
    } catch {
      // History load failed — not critical
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus.set('disconnected');
    this.handshakeComplete = false;
    this.sessionKey = '';
    this.isTyping.set(false);
    this.messages.update(msgs => msgs.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  }

  clearMessages(): void {
    this.messages.set([]);
  }
}
