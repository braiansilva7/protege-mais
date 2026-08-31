import type { AppDatabase, DatabaseConnection } from '@protege-mais/plugins';
import type {
  LoginAuthenticationUseCase,
  LoginRateLimiter,
  RefreshAuthenticationSessionUseCase,
} from '@protege-mais/interfaces';
import type { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    DatabaseRw: AppDatabase;
    DatabaseRo: AppDatabase;
    dbPool: Pool;
    databaseConnection: DatabaseConnection;
    loginRateLimiter: LoginRateLimiter;
    loginWithEmailAndPassword: LoginAuthenticationUseCase;
    refreshAuthenticationSession: RefreshAuthenticationSessionUseCase;
  }
}
