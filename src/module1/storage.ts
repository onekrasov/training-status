import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { JsonStorage } from './types';

function normalizeKey(prefix: string | undefined, key: string): string {
  const cleanPrefix = (prefix ?? '').replace(/^\/+|\/+$/g, '');
  return cleanPrefix ? `${cleanPrefix}/${key}` : key;
}

async function bodyToString(body: unknown): Promise<string> {
  if (!body || typeof body !== 'object' || !('transformToString' in body)) {
    throw new Error('S3 object body does not support transformToString().');
  }

  return (body as { transformToString(): Promise<string> }).transformToString();
}

export class S3JsonStorage implements JsonStorage {
  private readonly client: S3Client;

  private readonly bucket: string;

  private readonly prefix?: string;

  public constructor(options: { bucket: string; prefix?: string; client?: S3Client }) {
    this.client = options.client ?? new S3Client({});
    this.bucket = options.bucket;
    this.prefix = options.prefix;
  }

  public async getJson<T>(key: string): Promise<T | undefined> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: normalizeKey(this.prefix, key),
        }),
      );

      const content = await bodyToString(response.Body);
      return JSON.parse(content) as T;
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') {
        return undefined;
      }

      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
        return undefined;
      }

      throw error;
    }
  }

  public async putJson<T>(key: string, value: T): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizeKey(this.prefix, key),
        Body: JSON.stringify(value, null, 2),
        ContentType: 'application/json',
      }),
    );
  }
}
