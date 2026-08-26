import { Type } from '@sinclair/typebox';
import {
  errorResponseSchema,
  operationalStatusSchema,
} from '../../common/responses/index.js';
import { apiTags } from '../../openapi/index.js';

export const readinessSchema = {
  summary: 'Verificar readiness da aplicação',
  description:
    'Confirma que o processo pode receber tráfego e que todos os probes obrigatórios estão disponíveis.',
  operationId: 'getReadiness',
  tags: [apiTags.health],
  security: [],
  response: {
    200: Type.Ref(operationalStatusSchema, {
      description: 'O processo está pronto para receber tráfego.',
    }),
    503: Type.Ref(errorResponseSchema, {
      description:
        'Um ou mais probes obrigatórios estão indisponíveis. O código retornado é SERVICE_NOT_READY.',
    }),
  },
};
