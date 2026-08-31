import { Type, type Static } from '@sinclair/typebox';

export const refreshAuthenticationRequestSchema = Type.Object(
  {
    refreshToken: Type.String({
      minLength: 1,
      maxLength: 4_096,
      description:
        'Refresh token corrente. O envio bem-sucedido o invalida imediatamente.',
    }),
  },
  {
    additionalProperties: false,
    description: 'Credencial renovável de uso único da sessão.',
  }
);

export type RefreshAuthenticationRequest = Static<
  typeof refreshAuthenticationRequestSchema
>;
