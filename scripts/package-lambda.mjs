import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const output = path.join(root, 'build/lambda');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

fs.cpSync(path.join(root, 'apps/processing/dist'), output, { recursive: true });
fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));
const processingPackage = JSON.parse(fs.readFileSync(path.join(root, 'apps/processing/package.json'), 'utf8'));
const dependencies = Object.entries(processingPackage.dependencies).map(([name, version]) => `${name}@${version}`);
execFileSync('npm', ['install', '--omit=dev', '--no-package-lock', '--prefix', output, ...dependencies], { stdio: 'inherit' });

const sharedPackage = path.join(output, 'node_modules/@training-status/shared');
fs.mkdirSync(sharedPackage, { recursive: true });
fs.cpSync(path.join(root, 'packages/shared/dist'), path.join(sharedPackage, 'dist'), { recursive: true });
fs.writeFileSync(path.join(sharedPackage, 'package.json'), JSON.stringify({ name: '@training-status/shared', type: 'module', main: './dist/index.js' }));
console.log(`Lambda artifact created at ${output}`);
