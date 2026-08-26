# Catálogo da API

## Estado atual

O baseline não possui rotas de autenticação, usuários, papéis ou negócio.

| Rota          | Autenticação | Estado                 | Observação                                     |
| ------------- | ------------ | ---------------------- | ---------------------------------------------- |
| `GET /health` | Não          | Disponível             | Liveness; retorna `{ "status": "ok" }`         |
| `GET /ready`  | Não          | Disponível             | Readiness dos probes obrigatórios              |
| `/swagger/*`  | Não          | `LOCAL`, `DEV` e `HMG` | UI, JSON e YAML do contrato OpenAPI 3.1        |
| `/api/v1/*`   | —            | Sem rotas              | Prefixo exclusivo das rotas futuras de domínio |

## OpenAPI

`packages/schema` é a fonte oficial de contratos HTTP. Health, readiness,
resposta comum de erro, tags e o esquema Bearer estão publicados no OpenAPI
3.1 com referências locais estáveis. O bootstrap rejeita rotas sem contrato
completo. A estrutura dos schemas, as regras de segurança, a validação e a
política que bloqueia toda exposição do Swagger em `PROD` estão em
[`OPENAPI.md`](OPENAPI.md).

## Health, readiness e ciclo de vida

`GET /health` confirma somente que o processo HTTP está vivo. Ele não consulta
banco, Redis ou serviço externo e continua retornando 200 enquanto o processo
puder responder. Use-o como liveness probe.

`GET /ready` confirma que a instância pode receber tráfego. Cada integração
obrigatória registra um probe com nome único no `ReadinessRegistry`; todos os
probes registrados são obrigatórios. Retorno `true` de todos produz 200 e:

```json
{
  "status": "ok"
}
```

Retorno `false` ou exceção de qualquer probe produz 503 pelo contrato global,
sem expor nome do probe, causa ou diagnóstico:

```json
{
  "code": "SERVICE_NOT_READY",
  "message": "O serviço não está pronto para receber tráfego.",
  "requestId": "req-42"
}
```

Neste incremento não há probe obrigatório registrado, portanto uma instância
inicializada responde pronta. O Redis registrará seu probe em `PROT-009`; o
PostgreSQL passará a integrar readiness quando sua fundação for consolidada em
`PROT-011`. O mecanismo não define timeout: cada integração deve executar um
check curto e limitado pelo timeout apropriado ao respectivo cliente.

Ao receber `SIGINT` ou `SIGTERM`, a API marca readiness como indisponível antes
de chamar o fechamento do Fastify. O encerramento é idempotente, para de aceitar
novas conexões e executa os hooks `onClose`, incluindo o fechamento do pool
PostgreSQL existente.

Rotas operacionais e Swagger permanecem fora de `/api/v1`. Toda rota de
negócio deve ser registrada pelo agregador versionado, sem repetir o prefixo no
arquivo da rota.

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
- `message` é um texto público seguro traduzido em `pt-BR`, `en` ou `es`
  conforme `Accept-Language`, com fallback para `pt-BR`;
- `requestId` é o identificador gerado pelo Fastify para correlacionar a
  resposta com o log. Aceitação e propagação de correlação externa pertencem
  ao `PROT-008`.

Stack, causa interna, corpo recebido e detalhes do validador nunca fazem parte
do contrato. Erros de schema retornam a mensagem genérica de validação, sem
nomes de campos ou valores. Rotas inexistentes usam o mesmo formato 404 sem
refletir a URL solicitada.

A resposta informa o idioma efetivo em `Content-Language` e inclui
`Accept-Language` em `Vary`. Clientes devem tratar falhas por `code`, nunca por
comparação do texto traduzido. Idiomas, normalização, fallback e convenção de
chaves estão em [`INTERNATIONALIZATION.md`](INTERNATIONALIZATION.md).

## Classes e mapeamentos

| Classe                    | Status | Código default          |
| ------------------------- | -----: | ----------------------- |
| `ApplicationError`        |    500 | `APPLICATION_ERROR`     |
| `ValidationError`         |    400 | `VALIDATION_ERROR`      |
| `UnauthorizedError`       |    401 | `UNAUTHORIZED`          |
| `ForbiddenError`          |    403 | `FORBIDDEN`             |
| `NotFoundError`           |    404 | `NOT_FOUND`             |
| `ConflictError`           |    409 | `CONFLICT`              |
| `BusinessRuleError`       |    422 | `BUSINESS_RULE_ERROR`   |
| `InfrastructureError`     |    500 | `INFRASTRUCTURE_ERROR`  |
| `ServiceUnavailableError` |    503 | `SERVICE_UNAVAILABLE`   |
| Erro desconhecido         |    500 | `INTERNAL_SERVER_ERROR` |

Erros do Fastify que já possuem status 400, 401, 403, 404, 409 ou 422 são
convertidos para a classe correspondente. Outros erros HTTP de cliente mantêm
o status e usam `REQUEST_ERROR`. Erros de aplicação 5xx, como readiness,
preservam sua classe e seu código público; falha desconhecida continua virando o
500 genérico.

Uma regra prevista em controller ou use case deve lançar a subclasse
correspondente, nunca `Error` genérico. Código e mensagem públicos podem ser
especializados sem alterar o status fixo da subclasse:

```ts
throw new NotFoundError({
  code: 'VICTIM_NOT_FOUND',
  messageKey: 'victims.errors.notFound',
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

O OpenAPI é o contrato técnico principal. Este catálogo explica decisões e
fluxos que não cabem no schema.
