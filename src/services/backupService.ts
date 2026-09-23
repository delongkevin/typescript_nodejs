import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Repositories } from '../storage/factory';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * BackupService pushes JSON snapshots of the full inventory to AWS S3.
 * Useful for disaster recovery and cross-region replication.
 *
 * When AWS credentials are not configured, backups fail with a clear
 * message rather than silently dropping data.
 */
export class BackupService {
  private readonly client: S3Client;

  constructor(private readonly repos: Repositories) {
    this.client = new S3Client({ region: config.aws.region });
  }

  async backup(): Promise<{ key: string; deviceCount: number; groupCount: number }> {
    const devices = await this.repos.devices.list();
    const groups = await this.repos.groups.list();
    const snapshot = { createdAt: new Date().toISOString(), devices, groups };
    const key = `backups/${new Date().toISOString()}.json`;

    await this.client.send(new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: JSON.stringify(snapshot, null, 2),
      ContentType: 'application/json',
    }));

    logger.info('Backup uploaded', { key, deviceCount: devices.length, groupCount: groups.length });
    return { key, deviceCount: devices.length, groupCount: groups.length };
  }

  async listBackups(): Promise<{ key: string; size: number; lastModified: string }[]> {
    const out = await this.client.send(new ListObjectsV2Command({
      Bucket: config.aws.s3Bucket,
      Prefix: 'backups/',
    }));
    return (out.Contents ?? []).map((c) => ({
      key: c.Key!,
      size: c.Size ?? 0,
      lastModified: c.LastModified?.toISOString() ?? '',
    }));
  }

  async fetchBackup(key: string): Promise<string> {
    const out = await this.client.send(new GetObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
    }));
    return await out.Body!.transformToString();
  }
}
