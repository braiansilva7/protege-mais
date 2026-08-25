import {
  createDatabaseEnvironment,
  createEncryptionEnvironment,
  createJwtEnvironment,
  createManagerApiEnvironment,
  createMobileEnvironment,
  createRedisEnvironment,
  createS3Environment,
  createSmtpEnvironment,
  createWebEnvironment,
  createWorkerEnvironment,
  type EnvironmentSource,
} from './validation.js';
import { runtimeEnvironment } from './runtime.js';

export function managerApiEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createManagerApiEnvironment(source);
}

export function workerEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createWorkerEnvironment(source);
}

export function webEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createWebEnvironment(source);
}

export function mobileEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createMobileEnvironment(source);
}

export function databaseEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createDatabaseEnvironment(source);
}

export function redisEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createRedisEnvironment(source);
}

export function jwtEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createJwtEnvironment(source);
}

export function encryptionEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createEncryptionEnvironment(source);
}

export function s3Environment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createS3Environment(source);
}

export function smtpEnvironment(
  source: EnvironmentSource = runtimeEnvironment()
) {
  return createSmtpEnvironment(source);
}
