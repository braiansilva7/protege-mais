import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  authenticationDependencyTokens,
  type AccessTokenService,
  type AccountAuthenticationRepository,
  type AuthenticationAudit,
  type AuthenticationClock,
  type AuthenticationSessionIdGenerator,
  type CredentialAuthenticationUseCase,
  type LoginAuthenticationUseCase,
  type LoginRateLimitCounter,
  type LoginRateLimiter,
  type PasswordHashService,
} from '@protege-mais/interfaces';
import { FixedWindowLoginRateLimiter } from '@protege-mais/middlewares';
import { DrizzleAccountAuthenticationRepository } from '@protege-mais/repositories';
import {
  Argon2idPasswordHashService,
  JoseAccessTokenService,
  StructuredAuthenticationAudit,
  SystemAuthenticationClock,
  UuidV7AuthenticationSessionIdGenerator,
} from '@protege-mais/services';
import {
  AuthenticateWithEmailAndPassword,
  LoginWithEmailAndPassword,
} from '@protege-mais/use-cases';
import { container } from 'tsyringe';

export interface AuthenticationPluginOptions {
  readonly accessTokenSecret: string;
  readonly loginRateLimiter?: LoginRateLimiter;
  readonly loginUseCase?: LoginAuthenticationUseCase;
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
  dependencies.register<AuthenticationClock>(
    authenticationDependencyTokens.clock,
    { useValue: new SystemAuthenticationClock() }
  );
  dependencies.register<AccessTokenService>(
    authenticationDependencyTokens.accessTokenService,
    { useValue: new JoseAccessTokenService(options.accessTokenSecret) }
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
          scope.resolve(authenticationDependencyTokens.sessionIdGenerator),
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
}

export const registerAuthentication = fp<AuthenticationPluginOptions>(
  authenticationPlugin,
  {
    name: 'authentication',
    dependencies: ['database', 'redis'],
  }
);

export default registerAuthentication;
