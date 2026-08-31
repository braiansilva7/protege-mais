import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authSessionDeviceIdentifierMaximumLength,
  authSessionDeviceNameMaximumLength,
  authSessionUserAgentMaximumLength,
  isValidAuthSessionDeviceIdentifier,
  sanitizeAuthSessionDeviceName,
  sanitizeAuthSessionUserAgent,
} from './index.js';

void test('valida o identificador técnico e opaco do dispositivo', () => {
  assert.equal(isValidAuthSessionDeviceIdentifier('device:android-01'), true);
  assert.equal(isValidAuthSessionDeviceIdentifier('A'), true);
  assert.equal(isValidAuthSessionDeviceIdentifier('-invalid'), false);
  assert.equal(isValidAuthSessionDeviceIdentifier('device invalid'), false);
  assert.equal(
    isValidAuthSessionDeviceIdentifier(
      `a${'b'.repeat(authSessionDeviceIdentifierMaximumLength)}`
    ),
    false
  );
});

void test('sanitiza metadados textuais de sessão', () => {
  assert.equal(
    sanitizeAuthSessionDeviceName('  Notebook\n\tprotegido  '),
    'Notebook protegido'
  );
  assert.equal(
    sanitizeAuthSessionUserAgent(' Browser/1.0\r\n\tPlatform '),
    'Browser/1.0 Platform'
  );
  assert.equal(sanitizeAuthSessionDeviceName('\u0000\n\t'), null);
  assert.equal(sanitizeAuthSessionUserAgent(undefined), null);
});

void test('limita metadados por code point sem quebrar Unicode', () => {
  const deviceName = sanitizeAuthSessionDeviceName(
    '📱'.repeat(authSessionDeviceNameMaximumLength + 1)
  );
  const userAgent = sanitizeAuthSessionUserAgent(
    '🧩'.repeat(authSessionUserAgentMaximumLength + 1)
  );

  assert.equal(
    [...(deviceName ?? '')].length,
    authSessionDeviceNameMaximumLength
  );
  assert.equal(
    [...(userAgent ?? '')].length,
    authSessionUserAgentMaximumLength
  );
  assert.equal(deviceName?.endsWith('📱'), true);
  assert.equal(userAgent?.endsWith('🧩'), true);
});
