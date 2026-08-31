import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UnauthorizedError } from '@protege-mais/common';
import type {
  AccessTokenService,
  AuthenticateWithEmailAndPasswordInput,
  CredentialAuthenticationUseCase,
  IssueAccessTokenInput,
  VerifiedAccessToken,
} from '@protege-mais/interfaces';
import { LoginWithEmailAndPassword } from './login.js';

const fixedNow = new Date('2026-08-31T12:00:00.000Z');
const accountId = '01994b90-8100-7000-8000-000000000023';
const sessionId = '01994b90-8100-7000-8000-000000000024';

class CredentialAuthenticationDouble implements CredentialAuthenticationUseCase {
  public readonly inputs: AuthenticateWithEmailAndPasswordInput[] = [];

  public constructor(private readonly mfaEnabled = false) {}

  public execute(input: AuthenticateWithEmailAndPasswordInput) {
    this.inputs.push(input);
    return Promise.resolve({ accountId, mfaEnabled: this.mfaEnabled });
  }
}

class AccessTokenServiceDouble implements AccessTokenService {
  public readonly inputs: IssueAccessTokenInput[] = [];

  public issue(input: IssueAccessTokenInput) {
    this.inputs.push(input);
    return Promise.resolve({
      token: 'signed-access-token',
      expiresInSeconds: 900,
    });
  }

  public verify(): Promise<VerifiedAccessToken> {
    throw new Error('Não usado neste teste.');
  }
}

void test('autentica credenciais e emite somente o contrato público do token', async () => {
  const credentials = new CredentialAuthenticationDouble();
  const accessTokens = new AccessTokenServiceDouble();
  const subject = new LoginWithEmailAndPassword(
    credentials,
    accessTokens,
    { generate: () => sessionId },
    { now: () => fixedNow }
  );
  const input = {
    email: 'user@example.test',
    password: 'senha integral enviada ao núcleo',
  };

  const result = await subject.execute(input);

  assert.deepEqual(credentials.inputs, [input]);
  assert.deepEqual(accessTokens.inputs, [
    { accountId, sessionId, issuedAt: fixedNow },
  ]);
  assert.deepEqual(result, {
    accessToken: 'signed-access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.hasOwn(result, 'accountId'), false);
  assert.equal(Object.hasOwn(result, 'sessionId'), false);
  assert.equal(Object.hasOwn(result, 'mfaEnabled'), false);
});

void test('não cria identificador nem token quando as credenciais falham', async () => {
  let generatedSessionIds = 0;
  let issuedTokens = 0;
  const failure = new Error('credencial rejeitada');
  const subject = new LoginWithEmailAndPassword(
    {
      execute: () => Promise.reject(failure),
    },
    {
      issue: () => {
        issuedTokens += 1;
        return Promise.resolve({ token: 'unused', expiresInSeconds: 900 });
      },
      verify: () => Promise.reject(new Error('Não usado neste teste.')),
    },
    {
      generate: () => {
        generatedSessionIds += 1;
        return sessionId;
      },
    },
    { now: () => fixedNow }
  );

  await assert.rejects(
    subject.execute({ email: 'user@example.test', password: 'wrong' }),
    failure
  );
  assert.equal(generatedSessionIds, 0);
  assert.equal(issuedTokens, 0);
});

void test('não emite token para conta com MFA antes de existir challenge', async () => {
  let generatedSessionIds = 0;
  let issuedTokens = 0;
  const subject = new LoginWithEmailAndPassword(
    new CredentialAuthenticationDouble(true),
    {
      issue: () => {
        issuedTokens += 1;
        return Promise.resolve({ token: 'unused', expiresInSeconds: 900 });
      },
      verify: () => Promise.reject(new Error('Não usado neste teste.')),
    },
    {
      generate: () => {
        generatedSessionIds += 1;
        return sessionId;
      },
    },
    { now: () => fixedNow }
  );

  await assert.rejects(
    subject.execute({ email: 'user@example.test', password: 'valid' }),
    (error: unknown) =>
      error instanceof UnauthorizedError && error.code === 'INVALID_CREDENTIALS'
  );
  assert.equal(generatedSessionIds, 0);
  assert.equal(issuedTokens, 0);
});
