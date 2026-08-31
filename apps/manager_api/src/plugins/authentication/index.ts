import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  authenticationDependencyTokens,
  type AccessTokenService,
  type AccountAuthenticationRepository,
  type AuthenticationAudit,
  type AuthenticationClock,
  type AuthenticationSessionAudit,
  type AuthenticationSessionIdGenerator,
  type AuthenticationSessionRepository,
  type CredentialAuthenticationUseCase,
  type LoginAuthenticationUseCase,
  type LoginRateLimitCounter,
  type LoginRateLimiter,
  type PasswordHashService,
  type RefreshAuthenticationSessionUseCase,
  type RefreshTokenHashService,
  type RefreshTokenService,
} from '@protege-mais/interfaces';
import { FixedWindowLoginRateLimiter } from '@protege-mais/middlewares';
import {
  DrizzleAccountAuthenticationRepository,
  DrizzleAuthenticationSessionRepository,
} from '@protege-mais/repositories';
import {
  Argon2idPasswordHashService,
  JoseAccessTokenService,
  JoseRefreshTokenService,
  Sha256RefreshTokenHashService,
  StructuredAuthenticationAudit,
  StructuredAuthenticationSessionAudit,
  SystemAuthenticationClock,
  UuidV7AuthenticationSessionIdGenerator,
} from '@protege-mais/services';
import {
  AuthenticateWithEmailAndPassword,
  LoginWithEmailAndPassword,
  RefreshAuthenticationSession,
} from '@protege-mais/use-cases';
import { container } from 'tsyringe';

export interface AuthenticationPluginOptions {
  readonly accessTokenSecret: string;
  readonly loginRateLimiter?: LoginRateLimiter;
  readonly loginUseCase?: LoginAuthenticationUseCase;
  readonly refreshTokenSecret: string;
  readonly refreshUseCase?: RefreshAuthenticationSessionUseCase;
}

function authenticationPlugin(
  fastify: FastifyInstance,
  options: AuthenticationPluginOptions
) {
  const dependencies = container.createChildContainer();

  dependencies.register<AccountAuthenticationRepository>(
    authenticationDependencyTokens.accountRepository,
    {
      useValue: new DrizzleAccountAuthenticationRepository(fastify.DatabaseRw),
    }
  );
  dependencies.register<PasswordHashService>(
    authenticationDependencyTokens.passwordHashService,
    { useValue: new Argon2idPasswordHashService() }
  );
  dependencies.register<AuthenticationAudit>(
    authenticationDependencyTokens.audit,
    { useValue: new StructuredAuthenticationAudit(fastify.log) }
  );
  dependencies.register<AuthenticationSessionAudit>(
    authenticationDependencyTokens.sessionAudit,
    { useValue: new StructuredAuthenticationSessionAudit(fastify.log) }
  );
  dependencies.register<AuthenticationClock>(
    authenticationDependencyTokens.clock,
    { useValue: new SystemAuthenticationClock() }
  );
  dependencies.register<AccessTokenService>(
    authenticationDependencyTokens.accessTokenService,
    { useValue: new JoseAccessTokenService(options.accessTokenSecret) }
  );
  dependencies.register<RefreshTokenService>(
    authenticationDependencyTokens.refreshTokenService,
    { useValue: new JoseRefreshTokenService(options.refreshTokenSecret) }
  );
  dependencies.register<RefreshTokenHashService>(
    authenticationDependencyTokens.refreshTokenHashService,
    { useValue: new Sha256RefreshTokenHashService() }
  );
  dependencies.register<AuthenticationSessionRepository>(
    authenticationDependencyTokens.sessionRepository,
    {
      useValue: new DrizzleAuthenticationSessionRepository(fastify.DatabaseRw),
    }
  );
  dependencies.register<AuthenticationSessionIdGenerator>(
    authenticationDependencyTokens.sessionIdGenerator,
    { useValue: new UuidV7AuthenticationSessionIdGenerator() }
  );
  dependencies.register<LoginRateLimitCounter>(
    authenticationDependencyTokens.loginRateLimitCounter,
    { useValue: fastify.redis }
  );
  dependencies.register<CredentialAuthenticationUseCase>(
    authenticationDependencyTokens.authenticateWithEmailAndPassword,
    {
      useFactory: (scope) =>
        new AuthenticateWithEmailAndPassword(
          scope.resolve(authenticationDependencyTokens.accountRepository),
          scope.resolve(authenticationDependencyTokens.passwordHashService),
          scope.resolve(authenticationDependencyTokens.audit),
          scope.resolve(authenticationDependencyTokens.clock)
        ),
    }
  );
  dependencies.register<LoginAuthenticationUseCase>(
    authenticationDependencyTokens.loginWithEmailAndPassword,
    {
      useFactory: (scope) =>
        new LoginWithEmailAndPassword(
          scope.resolve(
            authenticationDependencyTokens.authenticateWithEmailAndPassword
          ),
          scope.resolve(authenticationDependencyTokens.accessTokenService),
          scope.resolve(authenticationDependencyTokens.refreshTokenService),
          scope.resolve(authenticationDependencyTokens.refreshTokenHashService),
          scope.resolve(authenticationDependencyTokens.sessionRepository),
          scope.resolve(authenticationDependencyTokens.sessionIdGenerator),
          scope.resolve(authenticationDependencyTokens.clock)
        ),
    }
  );
  dependencies.register<RefreshAuthenticationSessionUseCase>(
    authenticationDependencyTokens.refreshAuthenticationSession,
    {
      useFactory: (scope) =>
        new RefreshAuthenticationSession(
          scope.resolve(authenticationDependencyTokens.accessTokenService),
          scope.resolve(authenticationDependencyTokens.refreshTokenService),
          scope.resolve(authenticationDependencyTokens.refreshTokenHashService),
          scope.resolve(authenticationDependencyTokens.sessionRepository),
          scope.resolve(authenticationDependencyTokens.sessionAudit),
          scope.resolve(authenticationDependencyTokens.clock)
        ),
    }
  );
  dependencies.register<LoginRateLimiter>(
    authenticationDependencyTokens.loginRateLimiter,
    {
      useFactory: (scope) =>
        new FixedWindowLoginRateLimiter(
          scope.resolve(authenticationDependencyTokens.loginRateLimitCounter),
          options.accessTokenSecret
        ),
    }
  );

  fastify.decorate(
    'loginWithEmailAndPassword',
    options.loginUseCase ??
      dependencies.resolve<LoginAuthenticationUseCase>(
        authenticationDependencyTokens.loginWithEmailAndPassword
      )
  );
  fastify.decorate(
    'loginRateLimiter',
    options.loginRateLimiter ??
      dependencies.resolve<LoginRateLimiter>(
        authenticationDependencyTokens.loginRateLimiter
      )
  );
  fastify.decorate(
    'refreshAuthenticationSession',
    options.refreshUseCase ??
      dependencies.resolve<RefreshAuthenticationSessionUseCase>(
        authenticationDependencyTokens.refreshAuthenticationSession
      )
  );
}

export const registerAuthentication = fp<AuthenticationPluginOptions>(
  authenticationPlugin,
  {
    name: 'authentication',
    dependencies: ['database', 'redis'],
  }
);

export default registerAuthentication;
