import { Type, type Static } from '@sinclair/typebox';

export const loginResponseSchema = Type.Object(
  {
    accessToken: Type.String({
      minLength: 1,
      description:
        'JWT de acesso curto. O valor deve ser tratado como segredo e enviado como Bearer.',
    }),
    refreshToken: Type.String({
      minLength: 1,
      description:
        'Credencial renovável de uso único. O valor puro nunca é persistido ou registrado.',
    }),
    tokenType: Type.Literal('Bearer', {
      description: 'Esquema do cabeçalho Authorization.',
    }),
    expiresIn: Type.Integer({
      minimum: 1,
      description: 'Validade do access token, em segundos.',
    }),
    refreshExpiresIn: Type.Integer({
      minimum: 1,
      maximum: 2_592_000,
      description:
        'Tempo restante até a expiração absoluta da sessão, em segundos.',
    }),
  },
  {
    additionalProperties: false,
    description:
      'Par de credenciais emitido após autenticação ou rotação válida.',
  }
);

export type LoginResponse = Static<typeof loginResponseSchema>;
