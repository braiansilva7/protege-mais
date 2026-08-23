import { Type } from '@sinclair/typebox';
import { ETagSwagger } from '@protege-mais/common';

export const healthSchema = {
  description: 'Health check',
  tags: [ETagSwagger.health],
  response: {
    200: Type.Object({
      status: Type.Literal('ok'),
    }),
  },
};
