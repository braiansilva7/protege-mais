import { Type, type Static } from '@sinclair/typebox';
import { publicUserSchema } from '@core/schema/common/user.schema.js';

export const createUserResponseSchema = Type.Object({
  user: publicUserSchema,
});

export type CreateUserResponse = Static<typeof createUserResponseSchema>;
