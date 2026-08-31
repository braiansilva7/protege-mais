import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  AuthenticationSessionAudit,
  AuthenticationSessionRepository,
  IssueAccessTokenInput,
  IssueRefreshTokenInput,
  RotateAuthenticationSessionInput,
  RotateAuthenticationSessionResult,
  VerifiedRefreshToken,
} from '@protege-mais/interfaces';
import { InvalidRefreshTokenError } from './errors.js';
import { RefreshAuthenticationSession } from './refresh-session.js';

const accountId = '01994b90-8100-7000-8000-000000000023';
const sessionId = '01994b90-8100-7000-8000-000000000024';
const usedAt = new Date('2026-09-01T12:00:00.000Z');
const expiresAt = new Date('2026-09-30T12:00:00.000Z');
const verifiedToken: VerifiedRefreshToken = Object.freeze({
  accountId,
  sessionId,
  tokenId: 'a'.repeat(43),
  issuedAt: new Date('2026-08-31T12:00:00.000Z'),
  expiresAt,
});

class SessionRepositoryDouble implements AuthenticationSessionRepository {
  public readonly rotations: RotateAuthenticationSessionInput[] = [];

  public constructor(
    private readonly result: RotateAuthenticationSessionResult
  ) {}

  public create() {
    return Promise.resolve(true);
  }

  public rotate(input: RotateAuthenticationSessionInput) {
    this.rotations.push(input);
    return Promise.resolve(this.result);
  }
}

function createAuditDouble() {
  const events: string[] = [];
  const audit: AuthenticationSessionAudit = {
    recordRefreshSuccess: () => events.push('success'),
    recordRefreshFailure: () => events.push('failure'),
    recordRefreshReuse: () => events.push('reuse'),
  };
  return { audit, events };
}

function createSubject(input: {
  readonly repositoryResult: RotateAuthenticationSessionResult;
  readonly verified?: VerifiedRefreshToken | null;
}) {
  const accessInputs: IssueAccessTokenInput[] = [];
  const refreshInputs: IssueRefreshTokenInput[] = [];
  const sessions = new SessionRepositoryDouble(input.repositoryResult);
  const audit = createAuditDouble();
  const subject = new RefreshAuthenticationSession(
    {
      issue: (tokenInput) => {
        accessInputs.push(tokenInput);
        return Promise.resolve({
          token: 'successor-access-token',
          expiresInSeconds: 900,
        });
      },
      verify: () => Promise.reject(new Error('Não usado neste teste.')),
    },
    {
      issue: (tokenInput) => {
        refreshInputs.push(tokenInput);
        return Promise.resolve({
          token: 'successor-refresh-token',
          expiresAt,
          expiresInSeconds: 2_505_600,
        });
      },
      verify: () => Promise.resolve(input.verified ?? null),
    },
    { hash: (token) => `hash:${token}` },
    sessions,
    audit.audit,
    { now: () => new Date('2026-09-01T12:00:00.999Z') }
  );

  return { accessInputs, audit, refreshInputs, sessions, subject };
}

void test('rotaciona o hash e emite novo par sem estender a expiração', async () => {
  const setup = createSubject({
    repositoryResult: 'rotated',
    verified: verifiedToken,
  });

  const result = await setup.subject.execute({
    refreshToken: 'presented-refresh-token',
  });

  assert.deepEqual(setup.refreshInputs, [
    { accountId, sessionId, issuedAt: usedAt, expiresAt },
  ]);
  assert.deepEqual(setup.accessInputs, [
    { accountId, sessionId, issuedAt: usedAt },
  ]);
  assert.deepEqual(setup.sessions.rotations, [
    {
      sessionId,
      accountId,
      presentedRefreshTokenHash: 'hash:presented-refresh-token',
      successorRefreshTokenHash: 'hash:successor-refresh-token',
      expectedExpiresAt: expiresAt,
      usedAt,
    },
  ]);
  assert.deepEqual(result, {
    accessToken: 'successor-access-token',
    refreshToken: 'successor-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshExpiresIn: 2_505_600,
  });
  assert.deepEqual(setup.audit.events, ['success']);
  assert.equal(Object.isFrozen(result), true);
});

void test('token criptograficamente inválido falha antes de emitir ou consultar sessão', async () => {
  const setup = createSubject({ repositoryResult: 'rotated' });

  await assert.rejects(
    setup.subject.execute({ refreshToken: 'invalid' }),
    InvalidRefreshTokenError
  );
  assert.equal(setup.accessInputs.length, 0);
  assert.equal(setup.refreshInputs.length, 0);
  assert.equal(setup.sessions.rotations.length, 0);
  assert.deepEqual(setup.audit.events, ['failure']);
});

void test('sessão ausente e reuso compartilham o erro externo e auditam políticas distintas', async () => {
  for (const repositoryResult of ['invalid', 'reused'] as const) {
    const setup = createSubject({
      repositoryResult,
      verified: verifiedToken,
    });

    await assert.rejects(
      setup.subject.execute({ refreshToken: 'presented-refresh-token' }),
      (error: unknown) =>
        error instanceof InvalidRefreshTokenError &&
        error.code === 'INVALID_REFRESH_TOKEN' &&
        error.statusCode === 401
    );
    assert.deepEqual(setup.audit.events, [
      repositoryResult === 'reused' ? 'reuse' : 'failure',
    ]);
  }
});
