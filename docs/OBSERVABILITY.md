# Logging estruturado e correlação

## Contrato operacional

Manager API e Worker escrevem um objeto JSON por linha em `stdout`. O nível vem
de `LOG_LEVEL`; o formato não muda entre ambientes. O logger acrescenta `time`,
`level`, `service` e `environment` a todos os registros.

A Manager API desabilita os logs automáticos de request do Fastify, pois eles
incluem a URL bruta. Ao concluir uma requisição, emite
`http.request.completed` com estes campos:

| Campo           | Regra                                             |
| --------------- | ------------------------------------------------- |
| `requestId`     | identifica uma execução HTTP ou de job            |
| `correlationId` | preserva a cadeia entre API, eventos e jobs       |
| `method`        | método HTTP em maiúsculas                         |
| `route`         | template registrado, por exemplo `/cases/:caseId` |
| `statusCode`    | status HTTP final                                 |
| `durationMs`    | duração em milissegundos                          |
| `event`         | nome estável do evento operacional                |

Respostas 2xx e 3xx usam `info`, respostas 4xx usam `warn` e respostas 5xx
usam `error`. Uma rota inexistente usa `route: "unmatched"`; path, query e
identificadores enviados na URL não são copiados para o log.

Erros podem acrescentar `errorCode` e um `errorType` sintático. Mensagem,
stack, causa e objeto original do erro não fazem parte do log seguro. O Worker
usa `worker.ready`, `worker.stopped`, `worker.job.started`,
`worker.job.completed`, `worker.job.retry.scheduled` e `worker.job.failed`.
Eventos de fila usam `queue.connection.error`, `queue.producer.error` e
`queue.worker.error`.

## Cabeçalhos e propagação

A API aceita `x-request-id` e `x-correlation-id` quando o valor possui de 1 a
128 caracteres, inicia com letra ou número e contém somente letras, números,
`.`, `_`, `:` ou `-`. Cabeçalho ausente, duplicado ou inválido não gera erro
para o cliente: um UUIDv7 local é criado.

Toda resposta devolve os dois cabeçalhos. Sem correlação externa válida,
`correlationId` recebe o mesmo valor de `requestId`.

Um produtor de job deve publicar somente o resultado de
`correlationMetadata(request)`, nunca headers, body ou o logger inteiro. O
consumer usa `createWorkerJobLogger`: ele preserva o `correlationId`, cria um
novo `requestId` para a tentativa e devolve um child logger com ambos. O
envelope v1 transporta somente `correlationId` e payload mínimo; `requestId` de
uma tentativa nunca é reaproveitado por outra.

Conexões Redis usam somente `redis.connection.ready`,
`redis.connection.reconnecting`, `redis.connection.error` e
`redis.connection.closed`. Esses eventos não incluem URL, host, porta, database,
chave, valor ou mensagem original do cliente.

PostgreSQL usa somente `database.connection.ready`,
`database.connection.unavailable`, `database.pool.error` e
`database.connection.closed`. Falhas incluem no máximo `errorType` sintético;
`DATABASE_URL`, host, porta, usuário, database, mensagem, stack, causa e objeto
original do driver permanecem proibidos.

Eventos `worker.job.*` permitem somente `queue`, `processor`, `attempt`,
`maxAttempts`, `durationMs`, `failureType` e `errorCode`, além do contexto
comum. `failureType` usa `transient`, `terminal` ou `exhausted`. `jobId`, chave
de idempotência, payload, mensagem, stack e causa permanecem proibidos. O
catálogo e o runbook estão em [`WORKER_QUEUES.md`](WORKER_QUEUES.md).

## Allowlist

Campos comuns permitidos:

- `time`, `level`, `service`, `environment`, `event` e `msg`;
- `requestId`, `correlationId`, `method`, `route`, `statusCode` e `durationMs`;
- `errorCode` e `errorType` sanitizados;
- nome técnico de sinal, fila, processor ou integração, sem payload;
- contadores, tentativas e tempos operacionais que não reconstruam conteúdo.

Identificador de conta, usuário, organização, unidade, membership ou recurso
não pertence à allowlist base. Uma inclusão futura exige finalidade operacional,
revisão da política e teste de não vazamento.

## Denylist

Nunca registrar, mesmo em `LOCAL` ou `debug`:

- body, params, query, headers, cookies ou URL bruta;
- senha, hash, credencial, token, chave, segredo ou URL assinada;
- CPF, CNPJ, telefone, e-mail, endereço, matrícula, cargo ou dado médico;
- relato, narrativa, risco, medida ou conteúdo de ocorrência;
- latitude, longitude, coordenadas, `position`, localização ou local protegido;
- arquivo, evidência, buffer, payload ou objeto de configuração;
- mensagem, stack ou causa de erro de biblioteca/integração.

O logger aplica uma denylist recursiva e também mascara padrões reconhecíveis
de Bearer token, JWT, CPF, CNPJ numérico/alfanumérico e pares de coordenadas em
strings permitidas. Objetos cíclicos, getters que falham, `BigInt` e valores não
serializáveis recebem um marcador seguro. Redaction é defesa adicional: não
autoriza enviar um objeto amplo ao logger. Quem cria um evento deve construir
explicitamente apenas os campos da allowlist.

## Consulta operacional

Para acompanhar toda a cadeia de uma requisição em um arquivo local:

```bash
jq --arg id 'correlation-prot-008' \
  'select(.correlationId == $id)' application.log
```

Para localizar respostas internas e ordenar por duração:

```bash
jq -s '
  map(select(.event == "http.request.completed" and .statusCode >= 500))
  | sort_by(.durationMs)
  | reverse
' application.log
```

Para contar rejeições por template de rota, sem consultar paths reais:

```bash
jq -s '
  map(select(.event == "http.request.completed" and .statusCode >= 400))
  | group_by(.route)
  | map({ route: .[0].route, total: length })
' application.log
```

Em uma plataforma centralizada, use os mesmos campos como filtros estruturados.
Uma consulta operacional deve começar por `correlationId`, `event`, `route` ou
status, nunca por dado pessoal.

---

Documentação Protege Mais — Logging estruturado e correlação
