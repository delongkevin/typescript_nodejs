import { DeviceRepository, GroupRepository, UserRepository } from './repository';
import { MemoryDeviceRepository, MemoryGroupRepository, MemoryUserRepository } from './memory';
import { FileDeviceRepository, FileGroupRepository, FileUserRepository } from './file';
import { DynamoDeviceRepository } from './dynamo';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface Repositories {
  devices: DeviceRepository;
  groups: GroupRepository;
  users: UserRepository;
}

export function createRepositories(): Repositories {
  logger.info('Initializing storage backend', { backend: config.storageBackend });
  switch (config.storageBackend) {
    case 'memory':
      return {
        devices: new MemoryDeviceRepository(),
        groups: new MemoryGroupRepository(),
        users: new MemoryUserRepository(),
      };
    case 'file':
      return {
        devices: new FileDeviceRepository(config.dataDir),
        groups: new FileGroupRepository(config.dataDir),
        users: new FileUserRepository(config.dataDir),
      };
    case 'aws':
      // Groups and users still use file storage locally; devices go to DynamoDB.
      // In a production system, additional tables would back groups and users.
      return {
        devices: new DynamoDeviceRepository(config.aws.dynamoTable, config.aws.region),
        groups: new FileGroupRepository(config.dataDir),
        users: new FileUserRepository(config.dataDir),
      };
    default:
      throw new Error(`Unknown storage backend: ${config.storageBackend}`);
  }
}
