# Catálogo da API

## Estado atual

O baseline não possui rotas de autenticação, usuários, papéis ou negócio.

| Rota          | Autenticação | Estado                       | Observação                             |
| ------------- | ------------ | ---------------------------- | -------------------------------------- |
| `GET /health` | Não          | Disponível                   | Retorna `{ "status": "ok" }`           |
| `/swagger/`   | Não          | Disponível no baseline local | Documenta somente o contrato atual     |
| `/api/v1/*`   | —            | Sem rotas                    | Prefixo reservado para tickets futuros |

`GET /ready` será criado em `PROT-006` e não deve ser simulado antes disso.

## Contrato global de erro

Toda falha processada pela Manager API responde somente com estes campos:

```json
{
  "code": "VICTIM_NOT_FOUND",
  "message": "Recurso não encontrado.",
  "requestId": "req-42"
}
```

- `code` é estável; os defaults usam maiúsculas e podem ser especializados
  pelo domínio;
- `message` é um texto público seguro. Os defaults atuais estão em `pt-BR` e
  serão internacionalizados por `PROT-005` sem alterar `code`;
- `requestId` é o identificador gerado pelo Fastify para correlacionar a
  resposta com o log. Aceitação e propagação de correlação externa pertencem
  ao `PROT-008`.

Stack, causa interna, corpo recebido e detalhes do validador nunca fazem parte
do contrato. Erros de schema retornam a mensagem genérica de validação, sem
nomes de campos ou valores. Rotas inexistentes usam o mesmo formato 404 sem
refletir a URL solicitada.

## Classes e mapeamentos

| Classe                | Status | Código default          |
| --------------------- | -----: | ----------------------- |
| `ApplicationError`    |    500 | `APPLICATION_ERROR`     |
| `ValidationError`     |    400 | `VALIDATION_ERROR`      |
| `UnauthorizedError`   |    401 | `UNAUTHORIZED`          |
| `ForbiddenError`      |    403 | `FORBIDDEN`             |
| `NotFoundError`       |    404 | `NOT_FOUND`             |
| `ConflictError`       |    409 | `CONFLICT`              |
| `BusinessRuleError`   |    422 | `BUSINESS_RULE_ERROR`   |
| `InfrastructureError` |    500 | `INFRASTRUCTURE_ERROR`  |
| Erro desconhecido     |    500 | `INTERNAL_SERVER_ERROR` |

Erros do Fastify que já possuem status 400, 401, 403, 404, 409 ou 422 são
convertidos para a classe correspondente. Outros erros HTTP de cliente mantêm
o status e usam `REQUEST_ERROR`. Status interno ou erro sem mapeamento sempre
vira o 500 genérico.

Uma regra prevista em controller ou use case deve lançar a subclasse
correspondente, nunca `Error` genérico. Código e mensagem públicos podem ser
especializados sem alterar o status fixo da subclasse:

```ts
throw new NotFoundError({
  code: 'VICTIM_NOT_FOUND',
  message: 'Perfil não encontrado.',
});
```

Falhas 4xx geram somente metadados operacionais no log. Em falhas 5xx, o erro
desconhecido ou a causa original de infraestrutura fica no campo interno `err`,
associado ao `requestId`, e não é reutilizado na resposta. O handler não registra
body nem detalhes de validação. A política ampla de redaction e logging
estruturado será consolidada em `PROT-008`.

## Regra de atualização

Cada rota implementada deve documentar:

- método, path, finalidade e permissão;
- autenticação e escopos de organização/unidade;
- body, params, query e responses;
- códigos de erro estáveis;
- idempotência e concorrência, quando aplicável;
- efeitos síncronos, eventos e jobs publicados;
- exemplo fictício sem PII ou segredo.

O OpenAPI consolidado em `PROT-007` será o contrato técnico principal. Este
catálogo explica decisões e fluxos que não cabem no schema.
