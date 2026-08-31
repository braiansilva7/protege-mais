# Swagger e OpenAPI

## Fonte oficial

`packages/schema` é a fonte oficial de todo contrato HTTP da Manager API. O
package concentra schemas TypeBox de `body`, `params`, `querystring` e
`response`, os erros comuns, tags, tipos derivados e requisitos de segurança.
A rota apenas referencia o contrato exportado; não deve repetir um schema em
`apps/manager_api`.

Os schemas compartilhados possuem `$id` estável e são registrados uma vez no
Fastify. O gerador os publica em `components.schemas` e as operações usam
referências locais, como `#/components/schemas/ErrorResponse`. Não escreva
`$ref` manualmente.

## Estrutura de uma operação

Crie o contrato em `packages/schema/<dominio>/<operacao>/` e exporte-o pela
fronteira `packages/schema/index.ts`. Todo schema de rota declara:

- `summary`, `description` e um `operationId` único no documento;
- uma ou mais `tags` registradas no catálogo comum;
- `security: []` para rota pública ou `security: bearerAuthSecurity` para rota
  protegida;
- `params`, `querystring` e `body` quando fizerem parte da operação;
- todos os `response` de sucesso e erro previstos.

Exemplo de contrato protegido:

```ts
import { Type } from '@sinclair/typebox';
import { errorResponseSchema } from '../../common/responses/index.js';
import { apiTags, bearerAuthSecurity } from '../../openapi/index.js';

export const updateRecordSchema = {
  summary: 'Atualizar registro',
  description: 'Atualiza um registro acessível à organização autenticada.',
  operationId: 'updateRecord',
  tags: [apiTags.records],
  security: bearerAuthSecurity,
  params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
  querystring: Type.Object({ notify: Type.Optional(Type.Boolean()) }),
  body: Type.Object(
    { title: Type.String({ minLength: 1, maxLength: 120 }) },
    { additionalProperties: false }
  ),
  response: {
    200: Type.Object({ id: Type.String({ format: 'uuid' }) }),
    400: Type.Ref(errorResponseSchema, {
      description: 'Dados de entrada inválidos.',
    }),
  },
};
```

O exemplo ilustra o formato; a tag `records` só deve ser adicionada a
`apiTags` e `openApiTags` junto com o primeiro domínio real correspondente.
Campos que não se aplicam à operação são omitidos. Objetos de entrada e saída
devem rejeitar propriedades extras quando o contrato for fechado.

O hook `onRoute` da Manager API interrompe o registro de qualquer rota de
aplicação que não declare `schema`, `summary`, `description`, `operationId`,
`tags`, `security` e ao menos uma `response`. Assim, uma rota incompleta falha
durante o bootstrap em vez de desaparecer silenciosamente do OpenAPI.

## Erros, tags e segurança

`errorResponseSchema` e seu tipo TypeScript `ErrorResponse` vivem em
`packages/schema`. A resposta contém somente `code`, `message` e `requestId`.
Classes e regras de erro continuam em `packages/common`; serialização e
tradução continuam em `packages/plugins`.

Tags devem vir de `apiTags`, com descrição correspondente em `openApiTags`. O
esquema HTTP Bearer chamado `bearerAuth` está em
`components.securitySchemes`. Ele documenta o formato JWT sem incluir token. A
rota pública `POST /api/v1/auth/login` usa a tag `authentication` e
`security: []`; ainda não há endpoint protegido no baseline. As futuras rotas
protegidas devem usar `bearerAuthSecurity` junto com o middleware entregue pelos
tickets de identidade e acesso.

Exemplos devem ser inteiramente fictícios. Nunca inclua token, senha, chave,
credencial, URL com credencial, CPF, contato ou outro dado pessoal real no
schema ou na descrição.

## Geração e exposição

O plugin Swagger é registrado antes das rotas e sempre gera o documento
OpenAPI 3.1 em memória por `app.swagger()`. A exposição HTTP segue esta
política:

| `APP_ENVIRONMENT` | UI `/swagger/` | JSON `/swagger/json` | YAML `/swagger/yaml` |
| ----------------- | -------------- | -------------------- | -------------------- |
| `LOCAL`           | Disponível     | Disponível           | Disponível           |
| `DEV`             | Disponível     | Disponível           | Disponível           |
| `HMG`             | Disponível     | Disponível           | Disponível           |
| `PROD`            | Bloqueada      | Bloqueado            | Bloqueado            |

A UI usa Content Security Policy para os recursos estáticos e não envia o
documento para o validador remoto do Swagger. Em produção, as três URLs
respondem 404; a geração em memória permanece disponível para testes internos
e integração do processo.

## Validação

Execute a suíte da Manager API durante o desenvolvimento:

```bash
pnpm --filter @protege-mais/manager-api test
```

A suíte serializa e reabre o JSON, valida a estrutura OpenAPI, unicidade de
`operationId`, responses e referências locais, compara o contrato operacional,
confere que o login é público, tem body fechado e declara 200/400/401/429/500/503,
valida o security requirement de uma operação protegida, procura segredos nos
exemplos e testa a política de exposição em `LOCAL` e `PROD`.
