import { InventoryService } from './inventoryService';
import { MemoryDeviceRepository, MemoryGroupRepository, MemoryUserRepository } from '../storage/memory';

function makeService(): InventoryService {
  return new InventoryService({
    devices: new MemoryDeviceRepository(),
    groups: new MemoryGroupRepository(),
    users: new MemoryUserRepository(),
  });
}

describe('InventoryService', () => {
  it('creates and lists devices', async () => {
    const svc = makeService();
    const created = await svc.createDevice({
      name: 'Vocal Mic 1',
      type: 'microphone',
      model: 'ULXD',
      manufacturer: 'Shure',
      frequencyRange: { minMhz: 470, maxMhz: 534 },
    });
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('offline');
    const all = await svc.listDevices();
    expect(all).toHaveLength(1);
  });

  it('filters by type', async () => {
    const svc = makeService();
    await svc.createDevice({ name: 'Mic', type: 'microphone', model: 'A', manufacturer: 'X', frequencyRange: { minMhz: 470, maxMhz: 500 } });
    await svc.createDevice({ name: 'IEM', type: 'iem', model: 'B', manufacturer: 'Y', frequencyRange: { minMhz: 470, maxMhz: 500 } });
    const mics = await svc.listDevices({ type: 'microphone' });
    expect(mics).toHaveLength(1);
    expect(mics[0].type).toBe('microphone');
  });

  it('updates and deletes devices', async () => {
    const svc = makeService();
    const d = await svc.createDevice({ name: 'x', type: 'microphone', model: 'A', manufacturer: 'X', frequencyRange: { minMhz: 470, maxMhz: 500 } });
    const upd = await svc.updateDevice(d.id, { frequencyMhz: 480 });
    expect(upd?.frequencyMhz).toBe(480);
    expect(await svc.deleteDevice(d.id)).toBe(true);
    expect(await svc.getDevice(d.id)).toBeNull();
  });

  it('simulates discovery of multiple devices', async () => {
    const svc = makeService();
    const found = await svc.simulateDiscovery(5);
    expect(found).toHaveLength(5);
    expect((await svc.listDevices())).toHaveLength(5);
  });
});
