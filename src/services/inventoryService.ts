import { v4 as uuid } from 'uuid';
import { Device, CreateDeviceInput, UpdateDeviceInput, DeviceGroup, CreateGroupInput } from '../domain/types';
import { Repositories } from '../storage/factory';

/**
 * Inventory service: manages devices and device groups. Handles auto-discovery
 * simulation and bulk configuration.
 */
export class InventoryService {
  constructor(private readonly repos: Repositories) {}

  async listDevices(filter?: { type?: string; groupId?: string; status?: string }): Promise<Device[]> {
    const devices = await this.repos.devices.list();
    if (!filter) return devices;
    return devices.filter((d) =>
      (!filter.type || d.type === filter.type)
      && (!filter.groupId || d.groupId === filter.groupId)
      && (!filter.status || d.status === filter.status));
  }

  getDevice(id: string): Promise<Device | null> {
    return this.repos.devices.get(id);
  }

  async createDevice(input: CreateDeviceInput): Promise<Device> {
    const now = new Date().toISOString();
    const device: Device = {
      id: uuid(),
      name: input.name,
      type: input.type,
      model: input.model,
      manufacturer: input.manufacturer,
      frequencyMhz: input.frequencyMhz ?? null,
      frequencyRange: input.frequencyRange,
      status: 'offline',
      batteryPercent: null,
      rfSignalDb: null,
      audioLevelDb: null,
      location: input.location ?? null,
      groupId: input.groupId ?? null,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    return this.repos.devices.create(device);
  }

  async updateDevice(id: string, patch: UpdateDeviceInput): Promise<Device | null> {
    return this.repos.devices.update(id, patch as Partial<Device>);
  }

  deleteDevice(id: string): Promise<boolean> {
    return this.repos.devices.delete(id);
  }

  listGroups(): Promise<DeviceGroup[]> {
    return this.repos.groups.list();
  }

  async createGroup(input: CreateGroupInput): Promise<DeviceGroup> {
    const group: DeviceGroup = {
      id: uuid(),
      name: input.name,
      description: input.description ?? null,
      deviceIds: input.deviceIds ?? [],
      createdAt: new Date().toISOString(),
    };
    return this.repos.groups.create(group);
  }

  /**
   * Simulate device discovery on the network. In a real deployment this would
   * use mDNS/Shure Device Discovery Protocol to enumerate devices.
   */
  async simulateDiscovery(count = 3): Promise<Device[]> {
    const models = [
      { model: 'ULXD4Q', mfr: 'Shure', type: 'receiver' as const, range: { minMhz: 470, maxMhz: 534 } },
      { model: 'AD4D', mfr: 'Shure', type: 'receiver' as const, range: { minMhz: 470, maxMhz: 616 } },
      { model: 'PSM1000', mfr: 'Shure', type: 'iem' as const, range: { minMhz: 470, maxMhz: 698 } },
      { model: 'SM58 Wireless', mfr: 'Shure', type: 'microphone' as const, range: { minMhz: 470, maxMhz: 534 } },
    ];
    const created: Device[] = [];
    for (let i = 0; i < count; i++) {
      const m = models[i % models.length];
      const device = await this.createDevice({
        name: `${m.model}-${Math.floor(Math.random() * 1000)}`,
        type: m.type,
        model: m.model,
        manufacturer: m.mfr,
        frequencyRange: m.range,
        tags: ['auto-discovered'],
      });
      created.push(device);
    }
    return created;
  }
}
