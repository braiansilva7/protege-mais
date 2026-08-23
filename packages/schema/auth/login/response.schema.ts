import { Type, type Static } from '@sinclair/typebox';
import { publicUserSchema } from '@core/schema/common/user.schema.js';

export const loginResponseSchema = Type.Object({
  access_token: Type.String(),
  token_type: Type.Literal('Bearer'),
  expires_in: Type.String(),
  user: publicUserSchema,
});

export type LoginResponse = Static<typeof loginResponseSchema>;
