import fs from 'node:fs';
import path from 'node:path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.LOCALSTACK_ENDPOINT ?? 'http://localhost:4566';
const bucket = process.env.PROCESSED_S3_BUCKET ?? 'training-status-processed-dev';
const targetDir = path.resolve('apps/web/public/data');
const targetFile = path.join(targetDir, 'training-status.json');

const client = new S3Client({
  region: process.env.AWS_REGION ?? 'eu-west-1',
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
  },
});

const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: 'training-status.json' }));
const body = await response.Body?.transformToString();

if (!body) {
  throw new Error('Processed data was empty.');
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetFile, body, 'utf8');
console.log(`Saved ${targetFile}`);
