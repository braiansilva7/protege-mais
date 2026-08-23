import { Type, type Static } from '@sinclair/typebox';
import {
  publicUserSchema,
  errorMessageSchema,
} from '@core/schema/common/user.schema.js';
import { ETagSwagger } from '@core/common/enums/ETagSwagger.js';

export const meResponseSchema = Type.Object({
  user: publicUserSchema,
});

export type MeResponse = Static<typeof meResponseSchema>;

export const currentUserSchema = {
  description: 'Retorna o usuário autenticado',
  tags: [ETagSwagger.auth],
  security: [{ authenticateJwt: [] }],
  response: {
    200: meResponseSchema,
    401: errorMessageSchema,
  },
};
