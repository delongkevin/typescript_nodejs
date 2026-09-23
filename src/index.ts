import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import * as path from 'path';
import * as http from 'http';

import { config } from './config';
import { logger } from './utils/logger';
import { createRepositories } from './storage/factory';
import { AuthService } from './services/authService';
import { InventoryService } from './services/inventoryService';
import { MonitoringService } from './services/monitoringService';
import { BackupService } from './services/backupService';
import { FrequencyCoordinator } from './services/frequencyCoordinator';
import { createRoutes } from './api/routes';
import { requestLogger, errorHandler } from './api/middleware';
import { createGraphQLMiddleware } from './api/graphql';
import { attachWebSocket } from './api/websocket';

async function main(): Promise<void> {
  const repos = createRepositories();

  const authService = new AuthService(repos.users);
  const inventoryService = new InventoryService(repos);
  const monitoringService = new MonitoringService(repos);
  const backupService = new BackupService(repos);
  const coordinator = new FrequencyCoordinator();

  // Bootstrap a default admin user for first-run convenience.
  await authService.ensureAdmin('admin', process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin');

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(requestLogger());

  const deps = {
    auth: authService,
    inventory: inventoryService,
    monitoring: monitoringService,
    backup: backupService,
    coordinator,
  };

  app.use('/api', createRoutes(deps));

  // GraphQL at /graphql, sharing the same service layer.
  app.use('/graphql', await createGraphQLMiddleware(deps, authService));

  // Static web UI so anyone can use the app in a browser.
  app.use('/', express.static(path.join(__dirname, '..', 'public')));

  app.use(errorHandler());

  const server = http.createServer(app);
  attachWebSocket(server, authService, monitoringService);
  monitoringService.start();

  server.listen(config.port, () => {
    logger.info('Wireless Workbench server ready', {
      port: config.port,
      env: config.nodeEnv,
      endpoints: {
        rest: `http://localhost:${config.port}/api`,
        graphql: `http://localhost:${config.port}/graphql`,
        websocket: `ws://localhost:${config.port}/ws`,
        ui: `http://localhost:${config.port}/`,
      },
    });
  });

  const shutdown = () => {
    logger.info('Shutting down...');
    monitoringService.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Fatal startup error', { err: String(err), stack: err?.stack });
  process.exit(1);
});
