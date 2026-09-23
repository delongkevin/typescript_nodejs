import { CoordinationRequest, CoordinationResult, Device, FrequencyAssignment } from '../domain/types';

/**
 * Frequency coordination service.
 *
 * Given a set of devices, an overall RF band, and a minimum spacing, this
 * service computes a compatible frequency plan that avoids known interference.
 *
 * This is a simplified model of the coordination that Shure's Wireless
 * Workbench performs. The algorithm is greedy but respects:
 *   - device-specific tunable range (a device can only be tuned within its own
 *     `frequencyRange`)
 *   - excluded frequencies (e.g. active TV broadcast)
 *   - minimum inter-channel spacing to avoid intermodulation distortion
 */
export class FrequencyCoordinator {
  /**
   * Compute assignments for the requested devices. Returns any devices that
   * could not be placed in `unassigned`.
   */
  coordinate(request: CoordinationRequest, devices: Device[]): CoordinationResult {
    const byId = new Map(devices.map((d) => [d.id, d]));
    const assignments: FrequencyAssignment[] = [];
    const unassigned: string[] = [];
    const excluded = new Set((request.excluded ?? []).map((f) => this.round(f)));

    // Sort devices by narrowest tuning range first (Most Constrained Variable
    // heuristic). Devices with narrow ranges have fewer valid slots, so
    // placing them first improves overall packing.
    const orderedIds = [...request.deviceIds].sort((a, b) => {
      const da = byId.get(a);
      const db = byId.get(b);
      if (!da || !db) return 0;
      return (da.frequencyRange.maxMhz - da.frequencyRange.minMhz)
        - (db.frequencyRange.maxMhz - db.frequencyRange.minMhz);
    });

    for (const deviceId of orderedIds) {
      const device = byId.get(deviceId);
      if (!device) {
        unassigned.push(deviceId);
        continue;
      }

      const lower = Math.max(request.band.minMhz, device.frequencyRange.minMhz);
      const upper = Math.min(request.band.maxMhz, device.frequencyRange.maxMhz);
      if (upper <= lower) {
        unassigned.push(deviceId);
        continue;
      }

      const frequency = this.findFrequency(lower, upper, request.spacingMhz, assignments, excluded);
      if (frequency === null) {
        unassigned.push(deviceId);
      } else {
        assignments.push({ deviceId, frequencyMhz: frequency });
      }
    }

    return {
      assignments,
      unassigned,
      band: request.band,
      spacingMhz: request.spacingMhz,
    };
  }

  /**
   * Detect interference between two frequencies given a spacing threshold.
   */
  hasInterference(a: number, b: number, spacingMhz: number): boolean {
    return Math.abs(a - b) < spacingMhz;
  }

  private findFrequency(
    lower: number,
    upper: number,
    spacingMhz: number,
    assignments: FrequencyAssignment[],
    excluded: Set<number>,
  ): number | null {
    // Step through the band on a spacing-sized grid. This is efficient and
    // ensures all assignments are at least `spacingMhz` apart.
    for (let freq = lower; freq <= upper; freq += spacingMhz) {
      const rounded = this.round(freq);
      if (excluded.has(rounded)) continue;

      const conflict = assignments.some((a) => this.hasInterference(a.frequencyMhz, rounded, spacingMhz))
        || [...excluded].some((e) => this.hasInterference(e, rounded, spacingMhz));

      if (!conflict) return rounded;
    }
    return null;
  }

  private round(freq: number): number {
    return Math.round(freq * 1000) / 1000;
  }
}
