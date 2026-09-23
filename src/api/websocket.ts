import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AuthService } from '../services/authService';
import { MonitoringService } from '../services/monitoringService';
import { logger } from '../utils/logger';

/**
 * WebSocket server for real-time telemetry streaming.
 *
 * Clients connect with a Bearer token in the `token` query parameter and
 * receive telemetry samples pushed as JSON on the `/ws` endpoint.
 */
export function attachWebSocket(
  httpServer: HttpServer,
  authService: AuthService,
  monitoring: MonitoringService,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) {
      socket.destroy();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token || !authService.verifyToken(token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  const broadcast = (payload: unknown) => {
    const data = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });
  };

  monitoring.on('sample', (s) => broadcast({ type: 'sample', data: s }));
  monitoring.on('interference', (s) => broadcast({ type: 'interference', data: s }));

  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected', { total: wss.clients.size });
    ws.send(JSON.stringify({ type: 'welcome', data: monitoring.getAllLatest() }));
    ws.on('close', () => logger.info('WebSocket client disconnected', { total: wss.clients.size }));
  });

  return wss;
}
