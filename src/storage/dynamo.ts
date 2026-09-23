import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { Device } from '../domain/types';
import { DeviceRepository } from './repository';
import { logger } from '../utils/logger';

/**
 * AWS DynamoDB-backed device repository.
 *
 * The table is expected to have a partition key `id` (String). This class
 * (de)serializes Device objects as a single JSON attribute `data` for
 * simplicity, which is a common pattern for document-shaped entities.
 */
export class DynamoDeviceRepository implements DeviceRepository {
  private readonly client: DynamoDBClient;

  constructor(private readonly tableName: string, region: string) {
    this.client = new DynamoDBClient({ region });
    logger.info('DynamoDeviceRepository initialized', { tableName, region });
  }

  async list(): Promise<Device[]> {
    const out = await this.client.send(new ScanCommand({ TableName: this.tableName }));
    return (out.Items ?? []).map((item) => JSON.parse(item.data!.S!) as Device);
  }

  async get(id: string): Promise<Device | null> {
    const out = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: { id: { S: id } },
    }));
    if (!out.Item) return null;
    return JSON.parse(out.Item.data!.S!) as Device;
  }

  async create(device: Device): Promise<Device> {
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: {
        id: { S: device.id },
        data: { S: JSON.stringify(device) },
      },
    }));
    return device;
  }

  async update(id: string, patch: Partial<Device>): Promise<Device | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const updated: Device = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
    return this.create(updated);
  }

  async delete(id: string): Promise<boolean> {
    await this.client.send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: { id: { S: id } },
    }));
    return true;
  }
}
