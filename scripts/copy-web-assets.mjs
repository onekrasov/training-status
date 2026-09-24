import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'web');
const destinationDir = path.join(root, 'dist', 'web');

await mkdir(destinationDir, { recursive: true });
await cp(sourceDir, destinationDir, { recursive: true });
