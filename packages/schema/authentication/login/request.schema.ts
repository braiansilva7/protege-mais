import { Type, type Static } from '@sinclair/typebox';

export const loginRequestSchema = Type.Object(
  {
    email: Type.String({
      description:
        'E-mail da credencial local. A regra não enumerável é aplicada pelo núcleo de autenticação.',
    }),
    password: Type.String({
      description:
        'Senha integral, processada sem trim, mudança de caixa ou truncamento.',
    }),
  },
  {
    additionalProperties: false,
    description: 'Credenciais locais para iniciar uma sessão lógica.',
  }
);

export type LoginRequest = Static<typeof loginRequestSchema>;
