import * as dotenv from 'dotenv';

dotenv.config();

export type StorageBackend = 'memory' | 'file' | 'aws';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  storageBackend: StorageBackend;
  dataDir: string;
  aws: {
    region: string;
    s3Bucket: string;
    dynamoTable: string;
  };
}

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config: AppConfig = {
  port: parseInt(getEnv('PORT', '4000'), 10),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '8h'),
  storageBackend: getEnv('STORAGE_BACKEND', 'file') as StorageBackend,
  dataDir: getEnv('DATA_DIR', './data'),
  aws: {
    region: getEnv('AWS_REGION', 'us-east-1'),
    s3Bucket: getEnv('AWS_S3_BUCKET', 'wireless-workbench-backups'),
    dynamoTable: getEnv('AWS_DYNAMODB_TABLE', 'wireless-workbench-devices'),
  },
};
