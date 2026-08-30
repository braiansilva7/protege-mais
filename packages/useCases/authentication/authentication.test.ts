import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  AccountAuthenticationRepository,
  AuthenticationAccountRecord,
  AuthenticationAudit,
  PasswordHashService,
  RecordSuccessfulLoginInput,
} from '@protege-mais/interfaces';
import {
  AuthenticateWithEmailAndPassword,
  InvalidCredentialsError,
  invalidAuthenticationEmailLookupKey,
} from './index.js';

const fixedNow = new Date('2026-08-30T18:00:00.000Z');
const activeAccount: AuthenticationAccountRecord = {
  id: '01994b90-8100-7000-8000-000000000022',
  passwordHash: 'encoded-password-hash',
  status: 'active',
  mfaEnabled: false,
};

class RepositoryDouble implements AccountAuthenticationRepository {
  public readonly lookups: string[] = [];
  public readonly loginUpdates: RecordSuccessfulLoginInput[] = [];

  public constructor(
    private readonly account: AuthenticationAccountRecord | null,
    private readonly updateResult = true
  ) {}

  public findByNormalizedEmail(
    emailNormalized: string
  ): Promise<AuthenticationAccountRecord | null> {
    this.lookups.push(emailNormalized);
    return Promise.resolve(this.account);
  }

  public recordSuccessfulLogin(
    input: RecordSuccessfulLoginInput
  ): Promise<boolean> {
    this.loginUpdates.push(input);
    return Promise.resolve(this.updateResult);
  }
}

class PasswordHashDouble implements PasswordHashService {
  public readonly verifications: {
    readonly password: string;
    readonly encodedHash: string | null;
  }[] = [];

  public constructor(private readonly result: boolean) {}

  public hash(_password: string): Promise<string> {
    return Promise.resolve('unused-hash');
  }

  public verify(
    password: string,
    encodedHash: string | null
  ): Promise<boolean> {
    this.verifications.push({ password, encodedHash });
    return Promise.resolve(this.result);
  }

  public needsRehash(_encodedHash: string): boolean {
    return false;
  }
}

class AuditDouble implements AuthenticationAudit {
  public successTotal = 0;
  public failureTotal = 0;

  public recordSuccess(): void {
    this.successTotal += 1;
  }

  public recordFailure(): void {
    this.failureTotal += 1;
  }
}

function createSubject(input: {
  readonly account: AuthenticationAccountRecord | null;
  readonly passwordMatches: boolean;
  readonly updateResult?: boolean;
}) {
  const repository = new RepositoryDouble(
    input.account,
    input.updateResult ?? true
  );
  const passwordHashes = new PasswordHashDouble(input.passwordMatches);
  const audit = new AuditDouble();
  const subject = new AuthenticateWithEmailAndPassword(
    repository,
    passwordHashes,
    audit,
    { now: () => fixedNow }
  );

  return { audit, passwordHashes, repository, subject };
}

void test('autentica conta ativa e atualiza o último login condicionalmente', async () => {
  const { audit, passwordHashes, repository, subject } = createSubject({
    account: activeAccount,
    passwordMatches: true,
  });

  const result = await subject.execute({
    email: '  USER@Example.Test  ',
    password: 'senha correta e completa',
  });

  assert.deepEqual(repository.lookups, ['user@example.test']);
  assert.deepEqual(passwordHashes.verifications, [
    {
      password: 'senha correta e completa',
      encodedHash: activeAccount.passwordHash,
    },
  ]);
  assert.deepEqual(repository.loginUpdates, [
    {
      accountId: activeAccount.id,
      expectedPasswordHash: activeAccount.passwordHash,
      occurredAt: fixedNow,
    },
  ]);
  assert.deepEqual(result, {
    accountId: activeAccount.id,
    mfaEnabled: false,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.hasOwn(result, 'passwordHash'), false);
  assert.equal(Object.hasOwn(result, 'email'), false);
  assert.equal(audit.successTotal, 1);
  assert.equal(audit.failureTotal, 0);
});

void test('entrada de e-mail inválida ainda executa lookup e verifica hash fictício', async () => {
  const { passwordHashes, repository, subject } = createSubject({
    account: null,
    passwordMatches: false,
  });

  await assert.rejects(
    subject.execute({ email: 'sem-arroba', password: 'tentativa longa' }),
    InvalidCredentialsError
  );

  assert.deepEqual(repository.lookups, [invalidAuthenticationEmailLookupKey]);
  assert.deepEqual(passwordHashes.verifications, [
    { password: 'tentativa longa', encodedHash: null },
  ]);
});

void test('todos os estados inválidos devolvem o mesmo erro não enumerável', async () => {
  const cases = [
    { account: null, passwordMatches: false },
    { account: activeAccount, passwordMatches: false },
    {
      account: { ...activeAccount, status: 'blocked' as const },
      passwordMatches: true,
    },
    {
      account: { ...activeAccount, status: 'disabled' as const },
      passwordMatches: true,
    },
    {
      account: { ...activeAccount, passwordHash: null },
      passwordMatches: false,
    },
    { account: activeAccount, passwordMatches: true, updateResult: false },
  ];
  const serializedErrors: string[] = [];

  for (const testCase of cases) {
    const { audit, passwordHashes, repository, subject } =
      createSubject(testCase);

    await assert.rejects(
      subject.execute({
        email: 'user@example.test',
        password: 'tentativa de credencial',
      }),
      (error: unknown) => {
        assert.ok(error instanceof InvalidCredentialsError);
        serializedErrors.push(
          JSON.stringify({
            code: error.code,
            message: error.message,
            messageKey: error.messageKey,
            name: error.name,
            statusCode: error.statusCode,
          })
        );
        assert.equal('cause' in error, false);
        return true;
      }
    );

    assert.equal(repository.lookups.length, 1);
    assert.equal(passwordHashes.verifications.length, 1);
    assert.equal(audit.successTotal, 0);
    assert.equal(audit.failureTotal, 1);
  }

  assert.equal(new Set(serializedErrors).size, 1);
  assert.doesNotMatch(
    serializedErrors[0] ?? '',
    /blocked|disabled|missing|password.?hash|account.?state|conta/iu
  );
});
