import type { User } from '@core/common/types/user.js';
import type { PermissionAction } from '@core/common/types/permission.js';
import type { AppDatabase } from '@core/plugins/database/index.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { TFunction } from 'i18next';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { user_id: string; module: 'manager' };
    user: { user_id: string; module: 'manager' };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser?: User;
    t: TFunction;
  }

  interface FastifyInstance {
    authenticateJwt: (
      request: FastifyRequest,
      reply: FastifyReply,
      allowedPermissions: PermissionAction[]
    ) => Promise<void>;
    DatabaseRw: AppDatabase;
    DatabaseRo: AppDatabase;
    dbPool: Pool;
  }
}
