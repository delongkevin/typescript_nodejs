import { Device, DeviceGroup, User } from '../domain/types';
import { DeviceRepository, GroupRepository, UserRepository } from './repository';

/**
 * In-memory repository implementations. Fast, useful for tests and demos.
 * Data is lost on process restart.
 */

export class MemoryDeviceRepository implements DeviceRepository {
  private readonly items = new Map<string, Device>();

  async list(): Promise<Device[]> {
    return Array.from(this.items.values());
  }

  async get(id: string): Promise<Device | null> {
    return this.items.get(id) ?? null;
  }

  async create(device: Device): Promise<Device> {
    this.items.set(device.id, device);
    return device;
  }

  async update(id: string, patch: Partial<Device>): Promise<Device | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: Device = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}

export class MemoryGroupRepository implements GroupRepository {
  private readonly items = new Map<string, DeviceGroup>();

  async list(): Promise<DeviceGroup[]> {
    return Array.from(this.items.values());
  }

  async get(id: string): Promise<DeviceGroup | null> {
    return this.items.get(id) ?? null;
  }

  async create(group: DeviceGroup): Promise<DeviceGroup> {
    this.items.set(group.id, group);
    return group;
  }

  async update(id: string, patch: Partial<DeviceGroup>): Promise<DeviceGroup | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: DeviceGroup = { ...existing, ...patch, id };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}

export class MemoryUserRepository implements UserRepository {
  private readonly items = new Map<string, User>();

  async findByUsername(username: string): Promise<User | null> {
    for (const u of this.items.values()) {
      if (u.username === username) return u;
    }
    return null;
  }

  async create(user: User): Promise<User> {
    this.items.set(user.id, user);
    return user;
  }

  async list(): Promise<User[]> {
    return Array.from(this.items.values());
  }
}
