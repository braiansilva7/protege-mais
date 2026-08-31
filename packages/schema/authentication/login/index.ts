import { Type } from '@sinclair/typebox';
import { errorResponseSchema } from '../../common/responses/index.js';
import { apiTags } from '../../openapi/index.js';
import { loginRequestSchema } from './request.schema.js';
import { loginResponseSchema } from './response.schema.js';

export { loginRequestSchema, type LoginRequest } from './request.schema.js';
export { loginResponseSchema, type LoginResponse } from './response.schema.js';

export const loginSchema = {
  summary: 'Autenticar por e-mail e senha',
  description:
    'Valida uma credencial local sob rate limit, persiste a sessão vinculada ao dispositivo e emite um par rotacionável.',
  operationId: 'loginWithEmailAndPassword',
  tags: [apiTags.authentication],
  security: [],
  body: loginRequestSchema,
  response: {
    200: Type.Composite([loginResponseSchema], {
      description: 'Credencial válida, sessão criada e par de tokens emitido.',
    }),
    400: Type.Ref(errorResponseSchema, {
      description:
        'Estrutura da requisição inválida. O código retornado é VALIDATION_ERROR.',
    }),
    401: Type.Ref(errorResponseSchema, {
      description:
        'Credencial inválida sem revelar existência ou estado da conta. O código retornado é INVALID_CREDENTIALS.',
    }),
    429: Type.Ref(errorResponseSchema, {
      description:
        'Limite por cliente excedido. O código retornado é AUTHENTICATION_RATE_LIMITED e Retry-After informa a janela restante.',
    }),
    500: Type.Ref(errorResponseSchema, {
      description:
        'Falha interna sanitizada. O código retornado é INTERNAL_SERVER_ERROR.',
    }),
    503: Type.Ref(errorResponseSchema, {
      description:
        'Rate limit indisponível. O código retornado é AUTHENTICATION_UNAVAILABLE.',
    }),
  },
};
