import { Type } from '@sinclair/typebox';

export const languageCodeSchema = Type.Union([
  Type.Literal('pt-BR'),
  Type.Literal('en'),
  Type.Literal('es'),
]);

export const permissionActionSchema = Type.String();

export const publicUserSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  username: Type.String(),
  email: Type.String({ format: 'email' }),
  permission_role_id: Type.String({ format: 'uuid' }),
  permission_role: Type.Optional(
    Type.Object({
      id: Type.String({ format: 'uuid' }),
      name: Type.String(),
      code: Type.Union([Type.String(), Type.Null()]),
      is_system: Type.Boolean(),
      active: Type.Boolean(),
    })
  ),
  permissions: Type.Array(permissionActionSchema),
  country_id: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  language_code: languageCodeSchema,
  profile_picture_url: Type.Union([Type.String(), Type.Null()]),
  total_score: Type.Integer(),
  active: Type.Boolean(),
  created_at: Type.String(),
});

export const errorMessageSchema = Type.Object({
  message: Type.String(),
});
