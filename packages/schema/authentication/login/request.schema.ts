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
    deviceIdentifier: Type.String({
      maxLength: 128,
      pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$',
      description:
        'Identificador técnico opaco do dispositivo, sem fingerprint de hardware.',
    }),
    deviceName: Type.Optional(
      Type.String({
        maxLength: 120,
        description: 'Nome opcional e sanitizado para reconhecer a sessão.',
      })
    ),
  },
  {
    additionalProperties: false,
    description:
      'Credenciais locais e vínculo técnico para iniciar uma sessão.',
  }
);

export type LoginRequest = Static<typeof loginRequestSchema>;
