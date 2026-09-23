import { FrequencyCoordinator } from './frequencyCoordinator';
import { Device } from '../domain/types';

function makeDevice(id: string, range: { minMhz: number; maxMhz: number }): Device {
  return {
    id,
    name: id,
    type: 'microphone',
    model: 'test',
    manufacturer: 'test',
    frequencyMhz: null,
    frequencyRange: range,
    status: 'offline',
    batteryPercent: null,
    rfSignalDb: null,
    audioLevelDb: null,
    location: null,
    groupId: null,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('FrequencyCoordinator', () => {
  const coordinator = new FrequencyCoordinator();

  it('assigns compatible frequencies with required spacing', () => {
    const devices = [
      makeDevice('a', { minMhz: 470, maxMhz: 500 }),
      makeDevice('b', { minMhz: 470, maxMhz: 500 }),
      makeDevice('c', { minMhz: 470, maxMhz: 500 }),
    ];
    const result = coordinator.coordinate(
      { deviceIds: ['a', 'b', 'c'], band: { minMhz: 470, maxMhz: 500 }, spacingMhz: 0.5 },
      devices,
    );
    expect(result.assignments).toHaveLength(3);
    const freqs = result.assignments.map((a) => a.frequencyMhz).sort();
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i] - freqs[i - 1]).toBeGreaterThanOrEqual(0.5);
    }
    expect(result.unassigned).toHaveLength(0);
  });

  it('respects excluded frequencies', () => {
    const devices = [makeDevice('a', { minMhz: 470, maxMhz: 471 })];
    const result = coordinator.coordinate(
      { deviceIds: ['a'], band: { minMhz: 470, maxMhz: 471 }, spacingMhz: 0.5, excluded: [470, 470.5, 471] },
      devices,
    );
    expect(result.unassigned).toEqual(['a']);
  });

  it('reports unassigned when device range does not overlap band', () => {
    const devices = [makeDevice('a', { minMhz: 900, maxMhz: 950 })];
    const result = coordinator.coordinate(
      { deviceIds: ['a'], band: { minMhz: 470, maxMhz: 500 }, spacingMhz: 0.5 },
      devices,
    );
    expect(result.assignments).toHaveLength(0);
    expect(result.unassigned).toEqual(['a']);
  });

  it('detects interference between close frequencies', () => {
    expect(coordinator.hasInterference(500, 500.2, 0.5)).toBe(true);
    expect(coordinator.hasInterference(500, 501, 0.5)).toBe(false);
  });
});
