import { createUserRequestSchema } from './request.schema.js';
import { createUserResponseSchema } from './response.schema.js';
import { errorMessageSchema } from '@core/schema/common/user.schema.js';
import { ETagSwagger } from '@core/common/enums/ETagSwagger.js';

export const createUserSchema = {
  description: 'Cria um novo usuário',
  tags: [ETagSwagger.user],
  consumes: ['multipart/form-data', 'application/json'],
  security: [{ authenticateJwt: [] }],
  // Body validado manualmente para aceitar JSON e multipart (com foto).
  response: {
    201: createUserResponseSchema,
    400: errorMessageSchema,
    401: errorMessageSchema,
    403: errorMessageSchema,
    409: errorMessageSchema,
  },
};

export { createUserRequestSchema, createUserResponseSchema };
