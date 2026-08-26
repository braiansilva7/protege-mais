import { Type, type Static } from '@sinclair/typebox';

export const operationalStatusSchema = Type.Object(
  {
    status: Type.Literal('ok', {
      description: 'Estado operacional atual do processo.',
    }),
  },
  {
    $id: 'OperationalStatus',
    additionalProperties: false,
    description: 'Confirma que o processo respondeu ao probe operacional.',
    examples: [{ status: 'ok' }],
    title: 'OperationalStatus',
  }
);

export type OperationalStatus = Static<typeof operationalStatusSchema>;

export const errorResponseSchema = Type.Object(
  {
    code: Type.String({
      description: 'Código estável e legível por máquina.',
      examples: ['VALIDATION_ERROR'],
    }),
    message: Type.String({
      description: 'Mensagem segura e localizada para apresentação ao cliente.',
      examples: ['Os dados enviados são inválidos.'],
    }),
    requestId: Type.String({
      description: 'Identificador da requisição para correlação com os logs.',
      examples: ['req-42'],
    }),
  },
  {
    $id: 'ErrorResponse',
    additionalProperties: false,
    description: 'Resposta de erro comum da API, sem detalhes internos.',
    examples: [
      {
        code: 'VALIDATION_ERROR',
        message: 'Os dados enviados são inválidos.',
        requestId: 'req-42',
      },
    ],
    title: 'ErrorResponse',
  }
);

export type ErrorResponse = Static<typeof errorResponseSchema>;

export const sharedSchemas = [
  operationalStatusSchema,
  errorResponseSchema,
] as const;
