import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDirectory, '../..');
dotenv.config({ path: resolve(projectRoot, '.env') });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  return value;
}

function port(value: string | undefined, fallback = '3000'): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('Porta inválida.');
  }
  return parsed;
}

export const databaseEnvironment = {
  databaseUrl: required('DATABASE_URL'),
};

export function managerApiEnvironment() {
  const appEnvironment = required('APP_ENVIRONMENT');
  if (!['LOCAL', 'DEV', 'HMG', 'PROD'].includes(appEnvironment)) {
    throw new Error('APP_ENVIRONMENT deve ser LOCAL, DEV, HMG ou PROD.');
  }
  return {
    appEnvironment: appEnvironment as 'LOCAL' | 'DEV' | 'HMG' | 'PROD',
    port: port(process.env.API_PORT),
    corsOrigin: required('CORS_ORIGIN'),
  };
}
