import { Type } from '@sinclair/typebox';
import { loginRequestSchema } from './request.schema.js';
import { loginResponseSchema } from './response.schema.js';
import { errorMessageSchema } from '@core/schema/common/user.schema.js';
import { ETagSwagger } from '@core/common/enums/ETagSwagger.js';

export const loginSchema = {
  description: 'Autentica um usuário e retorna o token JWT',
  tags: [ETagSwagger.auth],
  body: loginRequestSchema,
  response: {
    200: loginResponseSchema,
    400: errorMessageSchema,
    401: errorMessageSchema,
  },
};

export { loginRequestSchema, loginResponseSchema };
