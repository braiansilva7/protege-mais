import { Type } from '@sinclair/typebox';
import { errorResponseSchema } from '../../common/responses/index.js';
import { apiTags } from '../../openapi/index.js';
import { loginResponseSchema } from '../login/response.schema.js';
import { refreshAuthenticationRequestSchema } from './request.schema.js';

export {
  refreshAuthenticationRequestSchema,
  type RefreshAuthenticationRequest,
} from './request.schema.js';

export const refreshAuthenticationSchema = {
  summary: 'Rotacionar refresh token',
  description:
    'Valida a credencial renovável corrente, troca seu hash atomicamente e emite um novo par sem estender a expiração absoluta.',
  operationId: 'refreshAuthenticationSession',
  tags: [apiTags.authentication],
  security: [],
  body: refreshAuthenticationRequestSchema,
  response: {
    200: Type.Composite([loginResponseSchema], {
      description: 'Refresh token rotacionado e novo par emitido.',
    }),
    400: Type.Ref(errorResponseSchema, {
      description:
        'Estrutura da requisição inválida. O código retornado é VALIDATION_ERROR.',
    }),
    401: Type.Ref(errorResponseSchema, {
      description:
        'Token inválido, expirado, revogado ou reutilizado. O código uniforme é INVALID_REFRESH_TOKEN.',
    }),
    500: Type.Ref(errorResponseSchema, {
      description:
        'Falha interna sanitizada. O código retornado é INTERNAL_SERVER_ERROR.',
    }),
  },
} satisfies Readonly<Record<string, unknown>>;
