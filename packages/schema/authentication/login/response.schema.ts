import { Type, type Static } from '@sinclair/typebox';

export const loginResponseSchema = Type.Object(
  {
    accessToken: Type.String({
      minLength: 1,
      description:
        'JWT de acesso curto. O valor deve ser tratado como segredo e enviado como Bearer.',
    }),
    tokenType: Type.Literal('Bearer', {
      description: 'Esquema do cabeçalho Authorization.',
    }),
    expiresIn: Type.Integer({
      minimum: 1,
      description: 'Validade do access token, em segundos.',
    }),
  },
  {
    additionalProperties: false,
    description:
      'Credencial de acesso curta emitida após autenticação local válida.',
  }
);

export type LoginResponse = Static<typeof loginResponseSchema>;
