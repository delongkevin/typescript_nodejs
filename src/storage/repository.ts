import { Device, DeviceGroup, User } from '../domain/types';

/**
 * Repository abstraction for persistence.
 * Multiple backends (in-memory, file, AWS DynamoDB) implement this interface.
 */
export interface DeviceRepository {
  list(): Promise<Device[]>;
  get(id: string): Promise<Device | null>;
  create(device: Device): Promise<Device>;
  update(id: string, patch: Partial<Device>): Promise<Device | null>;
  delete(id: string): Promise<boolean>;
}

export interface GroupRepository {
  list(): Promise<DeviceGroup[]>;
  get(id: string): Promise<DeviceGroup | null>;
  create(group: DeviceGroup): Promise<DeviceGroup>;
  update(id: string, patch: Partial<DeviceGroup>): Promise<DeviceGroup | null>;
  delete(id: string): Promise<boolean>;
}

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  create(user: User): Promise<User>;
  list(): Promise<User[]>;
}
