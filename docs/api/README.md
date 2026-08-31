# Catálogo da API

## Estado atual

O baseline possui uma rota pública de login e ainda não possui rotas de
usuários, papéis ou negócio.

| Rota                      | Autenticação | Estado                 | Observação                                |
| ------------------------- | ------------ | ---------------------- | ----------------------------------------- |
| `GET /health`             | Não          | Disponível             | Liveness; retorna `{ "status": "ok" }`    |
| `GET /ready`              | Não          | Disponível             | Readiness dos probes obrigatórios         |
| `POST /api/v1/auth/login` | Não          | Disponível             | Credencial local e access token de 15 min |
| `/swagger/*`              | Não          | `LOCAL`, `DEV` e `HMG` | UI, JSON e YAML do OpenAPI 3.1            |

## Login por e-mail e senha

`POST /api/v1/auth/login` possui `security: []`, recebe exatamente `email` e
`password` como strings e compõe `AuthenticateWithEmailAndPassword`. O núcleo
normaliza o e-mail, verifica Argon2id, aplica elegibilidade e confirma o último
login de forma condicional. A resposta 200 possui somente `accessToken`,
`tokenType: "Bearer"` e `expiresIn: 900`; token, senha ou outro segredo não
aparece nos exemplos do OpenAPI.

Conta ausente, senha incorreta, hash ausente/inválido e conta bloqueada ou
desabilitada não podem receber código, mensagem, headers ou estrutura
diferentes. O fluxo detalhado está em
[`../authentication/README.md`](../authentication/README.md).

O endpoint aceita cinco tentativas por endereço de cliente em uma janela fixa
de 60 segundos. O contador Redis usa identificador HMAC opaco, TTL obrigatório
e incremento/expiração atômicos; endereço, e-mail e senha não entram na chave.
A sexta tentativa retorna 429 `AUTHENTICATION_RATE_LIMITED` e `Retry-After` com
os segundos restantes. Falha ou resposta incoerente do Redis bloqueia o login
com 503 `AUTHENTICATION_UNAVAILABLE`, sem executar a verificação de credencial.

Respostas declaradas: 200 para sucesso, 400 `VALIDATION_ERROR`, 401
`INVALID_CREDENTIALS`, 429 `AUTHENTICATION_RATE_LIMITED`, 500
`INTERNAL_SERVER_ERROR` e 503 `AUTHENTICATION_UNAVAILABLE`. A operação não é
idempotente do ponto de vista do servidor: cada sucesso confirma
`last_login_at` e emite um novo token. Ela não publica evento ou job durável,
não cria refresh token e ainda não persiste uma sessão funcional.

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

O Redis registra um probe obrigatório chamado `redis`. Uma instância responde
pronta somente depois que a conexão estiver operacional e um `PING` limitado a
1 segundo retornar `PONG`; uma queda posterior produz 503 e a reconexão torna o
probe pronto novamente. O PostgreSQL registra o probe `postgresql`, executa
`SELECT 1` dentro dos limites do pool e também fecha/reabre readiness sem
reiniciar o processo. O registry não define timeout global: cada integração
executa um check curto e limitado pelo respectivo cliente. A operação está em
[`../REDIS.md`](../REDIS.md) e
[`../database/README.md`](../database/README.md).

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
- `requestId` é aceito por `x-request-id` quando seguro ou gerado como UUIDv7,
  e correlaciona a resposta com o log.

Toda resposta também devolve `x-request-id` e `x-correlation-id`. Sem um
`x-correlation-id` externo válido, a correlação usa o próprio `requestId`. O
formato aceito e a propagação para jobs estão em
[`OBSERVABILITY.md`](../OBSERVABILITY.md).

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
| `TooManyRequestsError`    |    429 | `TOO_MANY_REQUESTS`     |
| `BusinessRuleError`       |    422 | `BUSINESS_RULE_ERROR`   |
| `InfrastructureError`     |    500 | `INFRASTRUCTURE_ERROR`  |
| `ServiceUnavailableError` |    503 | `SERVICE_UNAVAILABLE`   |
| Erro desconhecido         |    500 | `INTERNAL_SERVER_ERROR` |

Erros do Fastify que já possuem status 400, 401, 403, 404, 409, 422 ou 429 são
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

Falhas geram somente metadados operacionais. Em 5xx, o log conserva
`errorCode`, um `errorType` sintético e a correlação, nunca mensagem, stack,
causa, body ou detalhes de validação. O evento de conclusão usa `warn` para 4xx
e `error` para 5xx.

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
