import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UnauthorizedError, ValidationError } from '@protege-mais/common';
import type {
  AccessTokenService,
  AuthenticateWithEmailAndPasswordInput,
  AuthenticationSessionRepository,
  CreateAuthenticationSessionInput,
  CredentialAuthenticationUseCase,
  IssueAccessTokenInput,
  IssueRefreshTokenInput,
  RefreshTokenService,
  RotateAuthenticationSessionInput,
  VerifiedAccessToken,
} from '@protege-mais/interfaces';
import { LoginWithEmailAndPassword } from './login.js';

const fixedNow = new Date('2026-08-31T12:00:00.789Z');
const normalizedNow = new Date('2026-08-31T12:00:00.000Z');
const refreshExpiresAt = new Date('2026-09-30T12:00:00.000Z');
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

class RefreshTokenServiceDouble implements RefreshTokenService {
  public readonly inputs: IssueRefreshTokenInput[] = [];

  public issue(input: IssueRefreshTokenInput) {
    this.inputs.push(input);
    return Promise.resolve({
      token: 'signed-refresh-token',
      expiresAt: refreshExpiresAt,
      expiresInSeconds: 2_592_000,
    });
  }

  public verify() {
    return Promise.resolve(null);
  }
}

class SessionRepositoryDouble implements AuthenticationSessionRepository {
  public readonly created: CreateAuthenticationSessionInput[] = [];

  public constructor(private readonly createsSession = true) {}

  public create(input: CreateAuthenticationSessionInput) {
    this.created.push(input);
    return Promise.resolve(this.createsSession);
  }

  public rotate(_input: RotateAuthenticationSessionInput) {
    return Promise.resolve<'invalid'>('invalid');
  }
}

function createSubject(input?: {
  readonly credentials?: CredentialAuthenticationUseCase;
  readonly sessions?: AuthenticationSessionRepository;
}) {
  const credentials =
    input?.credentials ?? new CredentialAuthenticationDouble();
  const accessTokens = new AccessTokenServiceDouble();
  const refreshTokens = new RefreshTokenServiceDouble();
  const sessions = input?.sessions ?? new SessionRepositoryDouble();
  const subject = new LoginWithEmailAndPassword(
    credentials,
    accessTokens,
    refreshTokens,
    { hash: (token) => `hash:${token}` },
    sessions,
    { generate: () => sessionId },
    { now: () => fixedNow }
  );

  return { accessTokens, credentials, refreshTokens, sessions, subject };
}

void test('autentica, persiste metadata sanitizada e só então entrega o par', async () => {
  const setup = createSubject();
  const input = {
    email: 'user@example.test',
    password: 'senha integral enviada ao núcleo',
    deviceIdentifier: 'browser:device-024',
    deviceName: '  Notebook\nseguro  ',
    userAgent: ' Browser/1.0\r\n Test ',
  };

  const result = await setup.subject.execute(input);

  assert.deepEqual(
    (setup.credentials as CredentialAuthenticationDouble).inputs,
    [input]
  );
  assert.deepEqual(setup.accessTokens.inputs, [
    { accountId, sessionId, issuedAt: normalizedNow },
  ]);
  assert.deepEqual(setup.refreshTokens.inputs, [
    { accountId, sessionId, issuedAt: normalizedNow },
  ]);
  assert.deepEqual((setup.sessions as SessionRepositoryDouble).created, [
    {
      id: sessionId,
      accountId,
      refreshTokenHash: 'hash:signed-refresh-token',
      deviceIdentifier: 'browser:device-024',
      deviceName: 'Notebook seguro',
      userAgent: 'Browser/1.0 Test',
      expiresAt: refreshExpiresAt,
      createdAt: normalizedNow,
    },
  ]);
  assert.deepEqual(result, {
    accessToken: 'signed-access-token',
    refreshToken: 'signed-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshExpiresIn: 2_592_000,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.hasOwn(result, 'accountId'), false);
  assert.equal(Object.hasOwn(result, 'sessionId'), false);
});

void test('não cria identificador, tokens ou sessão quando a credencial falha', async () => {
  let generatedSessionIds = 0;
  let issuedTokens = 0;
  let createdSessions = 0;
  const failure = new Error('credencial rejeitada');
  const subject = new LoginWithEmailAndPassword(
    { execute: () => Promise.reject(failure) },
    {
      issue: () => {
        issuedTokens += 1;
        return Promise.resolve({ token: 'unused', expiresInSeconds: 900 });
      },
      verify: () => Promise.reject(new Error('Não usado neste teste.')),
    },
    {
      issue: () => {
        issuedTokens += 1;
        return Promise.resolve({
          token: 'unused',
          expiresAt: refreshExpiresAt,
          expiresInSeconds: 2_592_000,
        });
      },
      verify: () => Promise.resolve(null),
    },
    { hash: () => 'unused' },
    {
      create: () => {
        createdSessions += 1;
        return Promise.resolve(true);
      },
      rotate: () => Promise.resolve('invalid'),
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
    subject.execute({
      email: 'user@example.test',
      password: 'wrong',
      deviceIdentifier: 'browser:device-024',
    }),
    failure
  );
  assert.equal(generatedSessionIds, 0);
  assert.equal(issuedTokens, 0);
  assert.equal(createdSessions, 0);
});

void test('não emite tokens para MFA e rejeita metadata inválida antes da credencial', async () => {
  const mfa = createSubject({
    credentials: new CredentialAuthenticationDouble(true),
  });

  await assert.rejects(
    mfa.subject.execute({
      email: 'user@example.test',
      password: 'valid',
      deviceIdentifier: 'browser:device-024',
    }),
    (error: unknown) =>
      error instanceof UnauthorizedError && error.code === 'INVALID_CREDENTIALS'
  );
  assert.equal(mfa.accessTokens.inputs.length, 0);
  assert.equal(mfa.refreshTokens.inputs.length, 0);

  let credentialCalls = 0;
  const invalidMetadata = createSubject({
    credentials: {
      execute: () => {
        credentialCalls += 1;
        return Promise.resolve({ accountId, mfaEnabled: false });
      },
    },
  });
  await assert.rejects(
    invalidMetadata.subject.execute({
      email: 'user@example.test',
      password: 'valid',
      deviceIdentifier: 'device inválido',
    }),
    ValidationError
  );
  assert.equal(credentialCalls, 0);
});

void test('não entrega tokens se a conta perder elegibilidade antes do insert', async () => {
  const setup = createSubject({
    sessions: new SessionRepositoryDouble(false),
  });

  await assert.rejects(
    setup.subject.execute({
      email: 'user@example.test',
      password: 'valid',
      deviceIdentifier: 'browser:device-024',
    }),
    (error: unknown) =>
      error instanceof UnauthorizedError && error.code === 'INVALID_CREDENTIALS'
  );
});
