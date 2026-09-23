import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { InventoryService } from '../services/inventoryService';
import { MonitoringService } from '../services/monitoringService';
import { BackupService } from '../services/backupService';
import { FrequencyCoordinator } from '../services/frequencyCoordinator';
import {
  authenticate,
  authorize,
  validateBody,
  AuthedRequest,
} from './middleware';
import {
  createDeviceSchema,
  updateDeviceSchema,
  coordinationRequestSchema,
  createGroupSchema,
} from '../domain/types';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export interface RouteDeps {
  auth: AuthService;
  inventory: InventoryService;
  monitoring: MonitoringService;
  backup: BackupService;
  coordinator: FrequencyCoordinator;
}

export function createRoutes(deps: RouteDeps): Router {
  const router = Router();

  // -------------------- Health --------------------
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSec: Math.round(process.uptime()) });
  });

  // -------------------- Auth --------------------
  router.post('/auth/login', validateBody(loginSchema), async (req, res) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>;
    const result = await deps.auth.login(username, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json(result);
  });

  // -------------------- Devices --------------------
  router.get('/devices', authenticate(deps.auth), async (req, res) => {
    const { type, groupId, status } = req.query as Record<string, string | undefined>;
    const devices = await deps.inventory.listDevices({ type, groupId, status });
    res.json(devices);
  });

  router.get('/devices/:id', authenticate(deps.auth), async (req, res) => {
    const device = await deps.inventory.getDevice(req.params.id);
    if (!device) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(device);
  });

  router.post(
    '/devices',
    authenticate(deps.auth),
    authorize('admin', 'operator'),
    validateBody(createDeviceSchema),
    async (req, res) => {
      const device = await deps.inventory.createDevice(req.body);
      res.status(201).json(device);
    },
  );

  router.patch(
    '/devices/:id',
    authenticate(deps.auth),
    authorize('admin', 'operator'),
    validateBody(updateDeviceSchema),
    async (req, res) => {
      const updated = await deps.inventory.updateDevice(req.params.id, req.body);
      if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
      res.json(updated);
    },
  );

  router.delete(
    '/devices/:id',
    authenticate(deps.auth),
    authorize('admin'),
    async (req, res) => {
      const ok = await deps.inventory.deleteDevice(req.params.id);
      if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
      res.status(204).send();
    },
  );

  router.post(
    '/devices/discover',
    authenticate(deps.auth),
    authorize('admin', 'operator'),
    async (req, res) => {
      const count = Number((req.query.count as string) ?? 3);
      const created = await deps.inventory.simulateDiscovery(count);
      res.status(201).json({ discovered: created.length, devices: created });
    },
  );

  // -------------------- Groups --------------------
  router.get('/groups', authenticate(deps.auth), async (_req, res) => {
    res.json(await deps.inventory.listGroups());
  });

  router.post(
    '/groups',
    authenticate(deps.auth),
    authorize('admin', 'operator'),
    validateBody(createGroupSchema),
    async (req, res) => {
      const group = await deps.inventory.createGroup(req.body);
      res.status(201).json(group);
    },
  );

  // -------------------- Frequency coordination --------------------
  router.post(
    '/coordinate',
    authenticate(deps.auth),
    authorize('admin', 'operator'),
    validateBody(coordinationRequestSchema),
    async (req, res) => {
      const devices = await deps.inventory.listDevices();
      const result = deps.coordinator.coordinate(req.body, devices);

      // Apply assignments immediately.
      await Promise.all(result.assignments.map((a) =>
        deps.inventory.updateDevice(a.deviceId, { frequencyMhz: a.frequencyMhz })));

      res.json(result);
    },
  );

  // -------------------- Monitoring --------------------
  router.get('/monitoring/latest', authenticate(deps.auth), (_req, res) => {
    res.json(deps.monitoring.getAllLatest());
  });

  router.get('/monitoring/:deviceId', authenticate(deps.auth), (req, res) => {
    const sample = deps.monitoring.getLatest(req.params.deviceId);
    if (!sample) { res.status(404).json({ error: 'No samples yet' }); return; }
    res.json(sample);
  });

  // -------------------- Backup (AWS S3) --------------------
  router.post(
    '/backups',
    authenticate(deps.auth),
    authorize('admin'),
    async (req: AuthedRequest, res) => {
      try {
        const result = await deps.backup.backup();
        res.status(201).json(result);
      } catch (err: any) {
        res.status(502).json({ error: 'Backup failed', message: err.message });
      }
    },
  );

  router.get(
    '/backups',
    authenticate(deps.auth),
    authorize('admin'),
    async (_req, res) => {
      try {
        res.json(await deps.backup.listBackups());
      } catch (err: any) {
        res.status(502).json({ error: 'List backups failed', message: err.message });
      }
    },
  );

  return router;
}
