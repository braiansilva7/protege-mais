import { Type, type Static } from '@sinclair/typebox';
import {
  publicUserSchema,
  errorMessageSchema,
} from '@core/schema/common/user.schema.js';
import { ETagSwagger } from '@core/common/enums/ETagSwagger.js';

export const listUsersResponseSchema = Type.Object({
  users: Type.Array(publicUserSchema),
});

export type ListUsersResponse = Static<typeof listUsersResponseSchema>;

export const listUsersSchema = {
  description: 'Lista usuários',
  tags: [ETagSwagger.user],
  security: [{ authenticateJwt: [] }],
  response: {
    200: listUsersResponseSchema,
    401: errorMessageSchema,
    403: errorMessageSchema,
  },
};
