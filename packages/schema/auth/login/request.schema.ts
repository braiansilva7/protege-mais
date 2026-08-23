import { Type, type Static } from '@sinclair/typebox';

export const loginRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 }),
});

export type LoginRequest = Static<typeof loginRequestSchema>;
