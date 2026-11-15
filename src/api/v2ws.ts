/**
 * ELO Pi V2 WebSocket Service
 *
 * Manages a single WebSocket connection to ws://<PI_HOST>:8091/v2/ws
 * Derives host from the HTTP base URL (port 8090).
 * Handles: connect, reconnect with bounded backoff, capability lifecycle,
 * preview subscription, inbound message dispatch, outbound command queuing.
 *
 * Usage: instantiate once, call connect(baseUrl), subscribe to events,
 * call send() for commands, call disconnect() on cleanup.
 */

import { normalizeBaseUrl } from './client';
import {
  V2InboundMessage,
  V2OutboundCommand,
  V2StateMessage,
  V2CommandResult,
} from '../types/v2';

export type V2WSEvent =
  | { kind: 'state'; message: V2StateMessage }
  | { kind: 'command_result'; message: V2CommandResult }
  | { kind: 'connected' }
  | { kind: 'disconnected'; reason?: string }
  | { kind: 'error'; error: string };

export type V2WSListener = (event: V2WSEvent) => void;

export function deriveWsUrl(httpBaseUrl: string): string {
  const normalized = normalizeBaseUrl(httpBaseUrl);
  try {
    const url = new URL(normalized);
    // V2 WebSocket is hosted on port 8091 on the same Pi host
    return `ws://${url.hostname}:8091/v2/ws`;
  } catch {
    // Fallback extraction
    const stripped = normalized.replace(/^https?:\/\//i, '').replace(/^ws:\/\//i, '');
    const host = stripped.split(/[:/]/)[0] || 'localhost';
    return `ws://${host}:8091/v2/ws`;
  }
}

const BACKOFF_MS  = [1000, 2000, 4000, 8000, 15000];
const MAX_BACKOFF = 15000;

export class V2WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Set<V2WSListener> = new Set();
  private baseUrl: string = '';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private visionAcquired = false;
  private previewSubscribed = false;
  private isControlActive = false;

  /** Subscribe to events. Returns unsubscribe fn. */
  subscribe(listener: V2WSListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: V2WSEvent) {
    this.listeners.forEach(l => {
      try { l(event); } catch {}
    });
  }

  connect(httpBaseUrl: string) {
    this.baseUrl = httpBaseUrl;
    this.shouldReconnect = true;
    this._open();
  }

  disconnect() {
    this.shouldReconnect = false;
    this._clearReconnectTimer();
    if (this.ws) {
      this.visionAcquired = false;
      this.previewSubscribed = false;
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  /** Call when Control tab becomes active */
  activateControl() {
    this.isControlActive = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._acquireVision();
      this._subscribePreview(true);
    }
  }

  /** Call when Control tab loses focus or app backgrounds */
  deactivateControl() {
    this.isControlActive = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._subscribePreview(false);
      this._releaseVision();
    }
  }

  send(cmd: V2OutboundCommand): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(cmd));
      return true;
    } catch {
      return false;
    }
  }

  get isConnected(): boolean {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private _open() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    const url = deriveWsUrl(this.baseUrl);
    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempt = 0;
        this.emit({ kind: 'connected' });
        if (this.isControlActive) {
          this._acquireVision();
          this._subscribePreview(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as V2InboundMessage;
          if (msg.type === 'state') {
            this.emit({ kind: 'state', message: msg as V2StateMessage });
          } else if (msg.type === 'command_result') {
            this.emit({ kind: 'command_result', message: msg as V2CommandResult });
          }
        } catch {}
      };

      ws.onerror = () => {
        this.emit({ kind: 'error', error: 'WebSocket error' });
      };

      ws.onclose = (e) => {
        this.visionAcquired = false;
        this.previewSubscribed = false;
        this.emit({ kind: 'disconnected', reason: e.reason || undefined });
        if (this.shouldReconnect) {
          this._scheduleReconnect();
        }
      };
    } catch (err: any) {
      this.emit({ kind: 'error', error: err?.message || 'Failed to open WebSocket' });
      if (this.shouldReconnect) this._scheduleReconnect();
    }
  }

  private _scheduleReconnect() {
    this._clearReconnectTimer();
    const delay = BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)] ?? MAX_BACKOFF;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) this._open();
    }, delay);
  }

  private _clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _acquireVision() {
    if (!this.visionAcquired) {
      this.send({ type: 'capability', name: 'vision', action: 'acquire' });
      this.visionAcquired = true;
    }
  }

  private _releaseVision() {
    if (this.visionAcquired) {
      this.send({ type: 'capability', name: 'vision', action: 'release' });
      this.visionAcquired = false;
    }
  }

  private _subscribePreview(enabled: boolean) {
    if (enabled !== this.previewSubscribed) {
      this.send({ type: 'preview_subscription', enabled });
      this.previewSubscribed = enabled;
    }
  }
}

/** Singleton instance for use across the app */
export const v2ws = new V2WebSocketService();
