import { z } from 'zod';

/**
 * Domain types for the Wireless Workbench system.
 *
 * These model the core entities used to plan, deploy, and monitor
 * Shure-style wireless microphone / IEM systems.
 */

export type DeviceType = 'microphone' | 'iem' | 'receiver' | 'transmitter' | 'antenna' | 'third-party';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'muted';

export interface FrequencyRange {
  /** Lower bound in MHz */
  minMhz: number;
  /** Upper bound in MHz */
  maxMhz: number;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  model: string;
  manufacturer: string;
  /** Assigned RF frequency in MHz */
  frequencyMhz: number | null;
  /** Operating range for the device (e.g. G50: 470-534 MHz) */
  frequencyRange: FrequencyRange;
  status: DeviceStatus;
  batteryPercent: number | null;
  rfSignalDb: number | null;
  audioLevelDb: number | null;
  location: string | null;
  groupId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description: string | null;
  deviceIds: string[];
  createdAt: string;
}

export interface FrequencyAssignment {
  deviceId: string;
  frequencyMhz: number;
}

export interface CoordinationRequest {
  /** Device IDs that need frequencies */
  deviceIds: string[];
  /** Global range to search within, e.g. TV band */
  band: FrequencyRange;
  /** Minimum spacing between assigned frequencies in MHz */
  spacingMhz: number;
  /** Frequencies known to be occupied (e.g. TV broadcast) */
  excluded?: number[];
}

export interface CoordinationResult {
  assignments: FrequencyAssignment[];
  unassigned: string[];
  band: FrequencyRange;
  spacingMhz: number;
}

export interface TelemetrySample {
  deviceId: string;
  timestamp: string;
  batteryPercent: number;
  rfSignalDb: number;
  audioLevelDb: number;
  interferenceDetected: boolean;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'operator' | 'viewer';
}

// -------- Zod validation schemas (used by middleware) --------

export const frequencyRangeSchema = z.object({
  minMhz: z.number().positive(),
  maxMhz: z.number().positive(),
}).refine((r) => r.maxMhz > r.minMhz, { message: 'maxMhz must be greater than minMhz' });

export const createDeviceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['microphone', 'iem', 'receiver', 'transmitter', 'antenna', 'third-party']),
  model: z.string().min(1),
  manufacturer: z.string().min(1),
  frequencyMhz: z.number().positive().nullable().optional(),
  frequencyRange: frequencyRangeSchema,
  location: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial();

export const coordinationRequestSchema = z.object({
  deviceIds: z.array(z.string()).min(1),
  band: frequencyRangeSchema,
  spacingMhz: z.number().positive(),
  excluded: z.array(z.number().positive()).optional(),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  deviceIds: z.array(z.string()).optional(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
