import type { WebSocketEvent } from "@video-cv/types";

export type WebSocketEventHandler = (event: WebSocketEvent) => void;

/**
 * Thin WebSocket wrapper that reconnects on close and dispatches
 * typed Video CV events to registered handlers.
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private handlers: Set<WebSocketEventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private readonly baseWsUrl: string,
    private readonly getToken: () => string | null,
  ) {}

  connect(sessionId: string): void {
    this.closed = false;
    this._open(sessionId);
  }

  private _open(sessionId: string): void {
    const token = this.getToken();
    const url = `${this.baseWsUrl}/sessions/${sessionId}/events${token ? `?token=${token}` : ""}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (ev) => {
      try {
        const event: WebSocketEvent = JSON.parse(ev.data as string);
        this.handlers.forEach((h) => h(event));
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      if (!this.closed) {
        this.reconnectTimer = setTimeout(() => this._open(sessionId), 3000);
      }
    };
  }

  on(handler: WebSocketEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
