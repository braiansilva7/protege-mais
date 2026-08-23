import { Type, type Static } from '@sinclair/typebox';
import { publicUserSchema } from '@core/schema/common/user.schema.js';

export const updateUserResponseSchema = Type.Object({
  user: publicUserSchema,
});

export type UpdateUserResponse = Static<typeof updateUserResponseSchema>;
