import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import jwt from 'jsonwebtoken';

/** Map of userId → set of connected WebSocket clients */
const clients = new Map<string, Set<WebSocket>>();

/**
 * Initialise the WebSocket server attached to an existing HTTP server.
 * Clients must authenticate by passing a JWT as the `token` query param.
 */
export function initWsServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');

    let userId: string;
    try {
      const payload = jwt.verify(token ?? '', process.env.JWT_SECRET!) as { sub: string };
      userId = payload.sub;
    } catch {
      ws.close(4001, 'Unauthorized');
      return;
    }

    // Register client
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(ws);

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
    });
  });

  return wss;
}

/**
 * Emit a JSON event to all WebSocket connections for a given userId.
 */
export function emitToUser(userId: string, event: object): void {
  const sockets = clients.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
