# Redis compartilhado

## Responsabilidade

O Redis é uma dependência obrigatória da Manager API e do Worker. A conexão
compartilhada fica em `packages/plugins/redis`, usa o cliente oficial `redis`,
aplica namespace por ambiente e oferece comandos mínimos para leitura, escrita,
expiração e exclusão. Desde o `PROT-010`, `packages/plugins/queues` usa BullMQ
com o adaptador do mesmo cliente para filas e conexões bloqueantes. O contrato
específico está em [`WORKER_QUEUES.md`](WORKER_QUEUES.md).

Redis não é fonte de verdade para dados de domínio. Uma perda de cache, lock ou
contador deve ser tratada de acordo com a semântica da capacidade que o criou;
registros duráveis continuam pertencendo ao PostgreSQL quando seus tickets os
implementarem.

## Usos permitidos

- cache de dado derivado, sempre com TTL compatível com sua finalidade;
- contadores efêmeros de rate limit;
- locks curtos com expiração e token de posse, quando o ticket consumidor
  definir a operação atômica correspondente;
- infraestrutura de filas, somente por meio do envelope, catálogo e produtor de
  `packages/plugins/queues`.

Não armazenar senha, token, chave de criptografia, conteúdo de evidência,
relato, CPF, endereço, dado médico ou geolocalização. Não usar Redis como
substituto de autorização, auditoria ou persistência durável. Uma nova classe
de dado exige revisão de segurança, finalidade, TTL e comportamento de perda.

## Convenção de chaves

Todo cliente criado pelo plugin acrescenta automaticamente:

```text
protege-mais:<ambiente>:
```

Os ambientes resultam em `protege-mais:local:`, `protege-mais:dev:`,
`protege-mais:hmg:` e `protege-mais:prod:`. O consumidor informa somente o
sufixo técnico no formato:

```text
<capacidade>:<recurso>:<identificador>
```

Exemplos fictícios:

```text
cache:catalog:summary
rate-limit:public-api:bucket-42
lock:integration:operation-42
queues:notifications:...
```

O prefixo impede colisão entre ambientes que compartilhem uma instância, mas
não é uma fronteira de segurança. Ambientes de produção devem permanecer
isolados por credenciais, rede e, preferencialmente, instância próprias. Chaves
e valores nunca entram em logs operacionais.

## Conexão, readiness e falhas

O cliente usa timeout de conexão de 2 segundos, timeout por comando de 1
segundo, fila interna limitada e offline queue desabilitada. Reconexões usam
backoff exponencial com jitter e teto aproximado de 2 segundos. Assim, comandos
falham rapidamente durante uma queda em vez de reter payloads indefinidamente
em memória.

As conexões de fila preservam o mesmo timeout de conexão, limite da fila interna
e backoff de reconexão. Produtores desabilitam offline queue para não acumular
publicações durante uma queda. Consumers mantêm reconexão e conexões bloqueantes
próprias para voltar a aguardar jobs quando o Redis se recuperar. BullMQ não usa
o `keyPrefix` do cliente: recebe explicitamente
`protege-mais:<ambiente>:queues` para manter seus scripts atômicos consistentes.

A Manager API registra um probe obrigatório chamado `redis`. `GET /ready`
retorna 503 enquanto o cliente não estiver pronto ou `PING` falhar, sem expor
nome do host, credencial ou diagnóstico. `GET /health` continua respondendo
apenas pela vida do processo. A recuperação da conexão torna readiness pronta
novamente sem reiniciar a API.

O Worker ainda não expõe endpoint HTTP. Durante `SIGINT` ou `SIGTERM`, fecha os
consumers, aguarda o job ativo, fecha as conexões BullMQ e por último a conexão
Redis genérica. A API fecha o cliente pelo lifecycle do Fastify. Eventos de
conexão contêm apenas nomes estáveis sob `redis.connection.*` e `queue.*`; a
`REDIS_URL` e mensagens do cliente não são registradas.

## Configuração

`REDIS_URL` aceita somente `redis://` ou `rediss://`, host e um database
numérico opcional. Query e fragment são rejeitados. Em produção, credenciais de
exemplo marcadas com `change-before-production` também são rejeitadas.

Produção deve usar `rediss://` quando o provedor oferecer TLS, injetar a URL por
secret manager e restringir a rede aos consumidores autorizados. Nunca envie o
objeto de configuração ou a URL ao logger.

## Operação local

O Compose usa `redis:8.10.0-alpine`, persiste AOF no volume
`protege_mais_redis_data`, publica a porta somente em `127.0.0.1:6379` e aguarda
`redis-cli ping` no healthcheck.

```bash
docker compose up -d --wait redis
docker compose exec redis redis-cli ping
```

Na execução dos apps diretamente pelo host, use:

```text
REDIS_URL=redis://127.0.0.1:6379/0
```

Dentro da rede do Compose, a Manager API e o Worker recebem
`REDIS_URL=redis://redis:6379/0` automaticamente.

Para validar o cliente contra Redis real:

```bash
pnpm --filter @protege-mais/plugins test:redis
pnpm --filter @protege-mais/worker test:redis
```

A primeira suíte comprova namespace, `set/get`, expiração, indisponibilidade e
retomada por reconexão. A segunda comprova fila/processor/use case, retry,
backoff, falha terminal, idempotência após reinício e shutdown com job ativo. Os
testes usam referências fictícias e removem seus jobs e chaves sem TTL ao
concluir. Em inspeções operacionais, prefira `SCAN` limitado ao namespace; não
use `KEYS *` em instâncias compartilhadas ou de produção e não altere estruturas
internas do BullMQ com `redis-cli`.

---

Documentação Protege Mais — Redis compartilhado
