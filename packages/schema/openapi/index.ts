export const apiTags = Object.freeze({
  authentication: 'Autenticação',
  health: 'Saúde da Aplicação',
});

export const openApiTags = Object.freeze([
  Object.freeze({
    name: apiTags.authentication,
    description: 'Login e ciclo de credenciais de acesso.',
  }),
  Object.freeze({
    name: apiTags.health,
    description: 'Endpoints de liveness e readiness da aplicação.',
  }),
]);

export const bearerAuthSecuritySchemeName = 'bearerAuth';

export const openApiSecuritySchemes = Object.freeze({
  [bearerAuthSecuritySchemeName]: Object.freeze({
    type: 'http' as const,
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT de acesso enviado no cabeçalho Authorization.',
  }),
});

export const bearerAuthSecurity = Object.freeze([
  Object.freeze({ [bearerAuthSecuritySchemeName]: Object.freeze([]) }),
]);
