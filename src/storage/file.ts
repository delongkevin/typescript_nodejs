import { promises as fs } from 'fs';
import * as path from 'path';
import { Device, DeviceGroup, User } from '../domain/types';
import { DeviceRepository, GroupRepository, UserRepository } from './repository';
import { logger } from '../utils/logger';

/**
 * File-backed JSON repositories. Data is persisted between restarts.
 * Simple mutex prevents concurrent write corruption within a single process.
 */

class FileStore<T extends { id: string }> {
  private cache: Map<string, T> | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<Map<string, T>> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const items: T[] = JSON.parse(raw);
      this.cache = new Map(items.map((i) => [i.id, i]));
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.cache = new Map();
        await this.persist();
      } else {
        throw err;
      }
    }
    return this.cache!;
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const items = Array.from(this.cache.values());
    await fs.writeFile(this.filePath, JSON.stringify(items, null, 2), 'utf8');
  }

  async withLock<R>(fn: () => Promise<R>): Promise<R> {
    const previous = this.writeLock;
    let release: () => void = () => undefined;
    this.writeLock = new Promise<void>((resolve) => { release = resolve; });
    try {
      await previous;
      return await fn();
    } finally {
      release();
    }
  }

  async list(): Promise<T[]> {
    const map = await this.load();
    return Array.from(map.values());
  }

  async get(id: string): Promise<T | null> {
    const map = await this.load();
    return map.get(id) ?? null;
  }

  async set(item: T): Promise<T> {
    return this.withLock(async () => {
      const map = await this.load();
      map.set(item.id, item);
      await this.persist();
      return item;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.withLock(async () => {
      const map = await this.load();
      const existed = map.delete(id);
      if (existed) await this.persist();
      return existed;
    });
  }
}

export class FileDeviceRepository implements DeviceRepository {
  private readonly store: FileStore<Device>;

  constructor(dataDir: string) {
    this.store = new FileStore<Device>(path.join(dataDir, 'devices.json'));
    logger.info('FileDeviceRepository initialized', { dataDir });
  }

  list(): Promise<Device[]> { return this.store.list(); }
  get(id: string): Promise<Device | null> { return this.store.get(id); }
  create(device: Device): Promise<Device> { return this.store.set(device); }

  async update(id: string, patch: Partial<Device>): Promise<Device | null> {
    const existing = await this.store.get(id);
    if (!existing) return null;
    const updated: Device = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
    return this.store.set(updated);
  }

  delete(id: string): Promise<boolean> { return this.store.delete(id); }
}

export class FileGroupRepository implements GroupRepository {
  private readonly store: FileStore<DeviceGroup>;

  constructor(dataDir: string) {
    this.store = new FileStore<DeviceGroup>(path.join(dataDir, 'groups.json'));
  }

  list(): Promise<DeviceGroup[]> { return this.store.list(); }
  get(id: string): Promise<DeviceGroup | null> { return this.store.get(id); }
  create(group: DeviceGroup): Promise<DeviceGroup> { return this.store.set(group); }

  async update(id: string, patch: Partial<DeviceGroup>): Promise<DeviceGroup | null> {
    const existing = await this.store.get(id);
    if (!existing) return null;
    const updated: DeviceGroup = { ...existing, ...patch, id };
    return this.store.set(updated);
  }

  delete(id: string): Promise<boolean> { return this.store.delete(id); }
}

export class FileUserRepository implements UserRepository {
  private readonly store: FileStore<User>;

  constructor(dataDir: string) {
    this.store = new FileStore<User>(path.join(dataDir, 'users.json'));
  }

  async findByUsername(username: string): Promise<User | null> {
    const users = await this.store.list();
    return users.find((u) => u.username === username) ?? null;
  }

  create(user: User): Promise<User> { return this.store.set(user); }
  list(): Promise<User[]> { return this.store.list(); }
}
