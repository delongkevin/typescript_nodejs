import { EventEmitter } from 'events';
import { TelemetrySample, Device } from '../domain/types';
import { Repositories } from '../storage/factory';
import { logger } from '../utils/logger';

/**
 * MonitoringService streams simulated telemetry (RF, audio, battery) for
 * every online device. Consumers (WebSocket, REST polling) subscribe via
 * the EventEmitter interface.
 *
 * In a real deployment, this data would come from Shure Device Discovery
 * Protocol / SNMP polling of the physical hardware.
 */
export class MonitoringService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private lastSamples = new Map<string, TelemetrySample>();

  constructor(private readonly repos: Repositories, private readonly intervalMs = 2000) {
    super();
  }

  start(): void {
    if (this.timer) return;
    logger.info('MonitoringService started', { intervalMs: this.intervalMs });
    this.timer = setInterval(() => { this.tick().catch((e) => logger.error('tick failed', { err: String(e) })); }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('MonitoringService stopped');
    }
  }

  getLatest(deviceId: string): TelemetrySample | undefined {
    return this.lastSamples.get(deviceId);
  }

  getAllLatest(): TelemetrySample[] {
    return Array.from(this.lastSamples.values());
  }

  private async tick(): Promise<void> {
    const devices = await this.repos.devices.list();
    for (const device of devices) {
      if (device.status === 'offline') continue;
      const sample = this.simulateSample(device);
      this.lastSamples.set(device.id, sample);
      this.emit('sample', sample);
      if (sample.interferenceDetected) {
        this.emit('interference', sample);
      }
    }
  }

  private simulateSample(device: Device): TelemetrySample {
    // Simulate realistic RF signal (-30 to -80 dB range), audio (-60 to 0),
    // battery drains gradually.
    const prev = this.lastSamples.get(device.id);
    const battery = prev
      ? Math.max(0, prev.batteryPercent - Math.random() * 0.5)
      : 70 + Math.random() * 30;
    const rf = -30 - Math.random() * 50;
    const audio = -Math.random() * 60;
    const interferenceDetected = rf < -75 && Math.random() < 0.3;
    return {
      deviceId: device.id,
      timestamp: new Date().toISOString(),
      batteryPercent: Math.round(battery * 10) / 10,
      rfSignalDb: Math.round(rf * 10) / 10,
      audioLevelDb: Math.round(audio * 10) / 10,
      interferenceDetected,
    };
  }
}
