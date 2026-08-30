import argon2 from 'argon2';
import {
  isAuthenticationPasswordWithinMaximumLength,
  isValidNewAuthenticationPassword,
  normalizeAuthenticationPassword,
} from '@protege-mais/common';
import type {
  AuthenticationAudit,
  AuthenticationClock,
  AuthenticationEventLogger,
  PasswordHashService,
} from '@protege-mais/interfaces';

export const argon2idPasswordHashParameters = Object.freeze({
  hashLength: 32,
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
  type: argon2.argon2id,
  version: 0x13,
});

const maximumEncodedPasswordHashLength = 512;
const encodedArgon2idPattern = /^\$argon2id\$v=19\$[^$]+\$[^$]+\$[^$]+$/u;
const dummyPassword = 'invalid-authentication-attempt-prot-022';

/**
 * Hash público e fictício usado somente para igualar o trabalho quando não há
 * credencial persistida. Ele não representa conta nem segredo real.
 */
export const authenticationDummyPasswordHash =
  '$argon2id$v=19$m=19456,p=1,t=2$cTTnkIkIHvJfGgS9AFzBcA$U0Mb8DdVnSy62YYbC/MukLBlQ6kJzmtyR6Ar8+YFwMA';

function isSupportedArgon2idHash(value: string): boolean {
  return (
    value.length <= maximumEncodedPasswordHashLength &&
    encodedArgon2idPattern.test(value)
  );
}

export class Argon2idPasswordHashService implements PasswordHashService {
  public async hash(password: string): Promise<string> {
    const normalizedPassword = normalizeAuthenticationPassword(password);

    if (!isValidNewAuthenticationPassword(normalizedPassword)) {
      throw new RangeError('A senha não atende à política aprovada.');
    }

    return argon2.hash(normalizedPassword, argon2idPasswordHashParameters);
  }

  public async verify(
    password: string,
    encodedHash: string | null
  ): Promise<boolean> {
    const withinMaximumLength =
      isAuthenticationPasswordWithinMaximumLength(password);
    const normalizedPassword = withinMaximumLength
      ? normalizeAuthenticationPassword(password)
      : dummyPassword;
    const supportedHash =
      encodedHash !== null && isSupportedArgon2idHash(encodedHash);
    const hashToVerify =
      withinMaximumLength && supportedHash
        ? encodedHash
        : authenticationDummyPasswordHash;

    try {
      const matches = await argon2.verify(hashToVerify, normalizedPassword);
      return withinMaximumLength && supportedHash && matches;
    } catch {
      if (hashToVerify !== authenticationDummyPasswordHash) {
        try {
          await argon2.verify(
            authenticationDummyPasswordHash,
            normalizedPassword
          );
        } catch {
          // A falha continua fechada e nunca inclui hash ou senha no erro.
        }
      }

      return false;
    }
  }

  public needsRehash(encodedHash: string): boolean {
    if (!isSupportedArgon2idHash(encodedHash)) return true;

    try {
      return argon2.needsRehash(encodedHash, argon2idPasswordHashParameters);
    } catch {
      return true;
    }
  }
}

export class StructuredAuthenticationAudit implements AuthenticationAudit {
  public constructor(private readonly logger: AuthenticationEventLogger) {}

  public recordSuccess(): void {
    this.logger.info(
      { event: 'authentication.succeeded' },
      'Credencial local autenticada.'
    );
  }

  public recordFailure(): void {
    this.logger.warn(
      { event: 'authentication.failed' },
      'Credencial local rejeitada.'
    );
  }
}

export class SystemAuthenticationClock implements AuthenticationClock {
  public now(): Date {
    return new Date();
  }
}
