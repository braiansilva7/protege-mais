import { Type } from '@sinclair/typebox';
import { ETagSwagger } from '@protege-mais/common';

export const readinessSchema = {
  description: 'Readiness check',
  tags: [ETagSwagger.health],
  response: {
    200: Type.Object({
      status: Type.Literal('ok'),
    }),
    503: Type.Object(
      {
        code: Type.Literal('SERVICE_NOT_READY'),
        message: Type.String(),
        requestId: Type.String(),
      },
      { additionalProperties: false }
    ),
  },
};
