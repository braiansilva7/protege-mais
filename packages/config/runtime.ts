import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const environmentPaths = [
  resolve(currentDirectory, '../../.env'),
  resolve(process.cwd(), '.env'),
];
const appWorkspaceRoot = resolve(process.cwd(), '../..');
if (existsSync(resolve(appWorkspaceRoot, 'pnpm-workspace.yaml'))) {
  environmentPaths.push(resolve(appWorkspaceRoot, '.env'));
}
const environmentPath = environmentPaths.find((path) => existsSync(path));

if (environmentPath) {
  dotenv.config({ path: environmentPath, quiet: true });
}

export function runtimeEnvironment(): Readonly<
  Record<string, string | undefined>
> {
  return process.env;
}
