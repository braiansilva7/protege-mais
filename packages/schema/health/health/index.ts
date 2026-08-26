import { Type } from '@sinclair/typebox';
import { operationalStatusSchema } from '../../common/responses/index.js';
import { apiTags } from '../../openapi/index.js';

export const healthSchema = {
  summary: 'Verificar liveness da aplicação',
  description:
    'Confirma que o processo está ativo. Não consulta dependências externas.',
  operationId: 'getHealth',
  tags: [apiTags.health],
  security: [],
  response: {
    200: Type.Ref(operationalStatusSchema, {
      description: 'O processo está ativo.',
    }),
  },
};
