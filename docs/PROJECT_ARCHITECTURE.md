# Arquitetura atual do Protege Mais

## Estado

Este documento registra somente o que existe após o `PROT-015`. A arquitetura
futura permanece em `docs/architecture/TARGET_ARCHITECTURE.md` e não deve ser
confundida com funcionalidade já entregue.

O monorepo possui quatro apps executáveis e dez packages compartilhados. A
primeira entidade persistente é `accounts`, separada de perfis e protegida por
constraints de identidade, unicidade ativa e projeção sem hash. Ainda não
existem autenticação, autorização, rotas/repositórios de negócio, seeds ou dados
de domínio. Existem 14 tipos enum fundamentais, com `account_type` e
`account_status` consumidos pela tabela. PostGIS está habilitado pela primeira
migration estrutural e validado com SRID 4326. As convenções de persistência
estão congeladas e comprovadas por um fixture Drizzle/Atlas isolado do schema
de produção. Redis já é uma dependência compartilhada com namespace por
ambiente, reconexão, timeouts e encerramento gracioso. As cinco filas base
usam BullMQ, envelope v1, publicação idempotente, retry/backoff e falha
controlada. A API possui pool PostgreSQL/Drizzle gerenciado, probes obrigatórios
para PostgreSQL e Redis, contrato global de erros,
internacionalização em `pt-BR`, `en` e `es`, liveness, readiness extensível,
encerramento gracioso e logs JSON correlacionados. Seus contratos HTTP geram
OpenAPI 3.1 e a exposição do Swagger segue uma política por ambiente, sem ativar
as integrações futuras. O Worker consome filas sem busy loop, cria correlação
por tentativa e delega toda execução a casos de uso registrados.

## Estrutura executável atual

```text
protege-mais/
├── apps/
│   ├── manager_api/          # Fastify: entrada HTTP
│   │   └── src/
│   │       ├── controllers/health/
│   │       ├── plugins/swagger/
│   │       ├── routes/
│   │       ├── types/
│   │       ├── app.ts         # Composição testável do Fastify
│   │       ├── lifecycle.ts   # Readiness e shutdown por sinais
│   │       └── server.ts      # Entrada do processo
│   ├── worker/               # Consumers, processors e lifecycle dos jobs
│   │   └── src/
│   │       ├── app.ts         # Composição do pool, processor e shutdown
│   │       ├── job-logger.ts  # Contexto correlacionado por tentativa
│   │       ├── job-processor.ts # Adaptação para casos de uso
│   │       ├── lifecycle.ts   # Espera e remoção de sinais
│   │       └── index.ts       # Entrada do processo
│   ├── web/                  # Shell institucional Vue
│   │   └── src/
│   └── mobile/               # Shell Expo/React Native
│       ├── App.tsx
│       └── index.ts
├── packages/
│   ├── common/               # Enums, erros, UUID e normalização de e-mail
│   ├── config/               # Configuração validada, tipada e imutável
│   ├── interfaces/           # Contratos de entrada compartilhados
│   ├── middlewares/          # Middlewares compartilhados futuros
│   ├── models/               # Accounts, enums, helpers e fixture Drizzle
│   ├── plugins/              # Banco, logging, Redis, filas e plugins Fastify
│   ├── repositories/         # Persistência por domínio futura
│   ├── schema/               # Fonte oficial dos contratos HTTP e OpenAPI
│   ├── services/             # Capacidades reutilizáveis futuras
│   └── useCases/             # Contrato/registry de jobs e orquestração futura
├── atlas/
│   ├── prod/                 # Migrations de PostGIS, enums e accounts
│   └── seed/dev/             # Checksum Atlas, sem seed
├── drizzle.reference.config.ts # Export do fixture, fora de produção
├── eslint.config.mjs       # Lint compartilhado e tipado
├── tsconfig.base.json      # Regras TypeScript comuns
├── tsconfig.json           # Node.js e aliases de packages
├── .prettierrc             # Formatação comum
├── .prettierignore         # Artefatos fora da formatação
└── docs/
```

## Workspaces e dependências

O `pnpm-workspace.yaml` reconhece `apps/*` e `packages/*`. Todos usam o namespace
`@protege-mais/`; o app HTTP é publicado internamente como
`@protege-mais/manager-api`, apesar de sua pasta continuar `manager_api`.

Cada package possui `package.json` e `index.ts` como fronteira pública. Nesta
fase eles são workspaces de código-fonte: o Manager API compila os packages que
consome, enquanto packages vazios permanecem como entrypoints preparados para
os tickets de domínio. Cada package possui `tsconfig.json` e scripts isolados de
lint, typecheck e formatter.

As dependências seguem uma única direção:

```text
apps → packages
```

Packages não importam nem declaram dependência de apps. Dependências externas
ficam no workspace que as utiliza; a raiz mantém somente ferramentas do
monorepo e de banco.

Entre packages, `plugins` consome erros de `common`, modelos de `models` e o
tipo HTTP compartilhado de `schema`; também encapsula BullMQ sem expô-lo ao
Worker ou aos casos de uso. `schema` depende somente do TypeBox e não depende
de `common`; assim, contratos de transporte não criam ciclo com regras de erro.
`useCases` define a execução e a classificação de falhas de jobs sem importar o
plugin de filas.

Os aliases compartilhados usam os nomes dos workspaces, por exemplo:

```text
@protege-mais/common
@protege-mais/config
@protege-mais/plugins
@protege-mais/schema
```

O alias legado `@core/*` não existe mais. Aliases locais de UI permanecem
restritos ao respectivo app.

## Qualidade e runtime

O runtime fixado é Node.js `24.12.0` com pnpm `11.9.0`. O `preinstall` impede a
instalação com outra versão do Node, e o lockfile preserva as versões resolvidas
para todos os workspaces.

`tsconfig.base.json` habilita explicitamente `strict`, `noImplicitAny`,
`strictNullChecks`, `useUnknownInCatchVariables`, consistência de nomes de
arquivo e bloqueio de emissão com erros. A raiz especializa essa base para
Node.js e centraliza os aliases de packages. Web e Mobile combinam a mesma base
com as configurações de seus runtimes.

O ESLint usa flat config e análise com informação de tipos nos arquivos
TypeScript. Vue e React Hooks possuem regras adequadas aos respectivos apps.
`any` explícito é erro; uma exceção exige desabilitação somente na linha
necessária e uma justificativa após `--`. O Prettier permanece responsável pelo
estilo mecânico. As convenções completas estão em `docs/QUALITY.md`.

Dependências, builds e caches são ignorados pelo lint e formatter. O lockfile
é mantido exclusivamente pelo pnpm e não é reformatado.

`packages/config` é a única fronteira que acessa `process.env`. O package
carrega o `.env` da raiz, preserva valores injetados pelo processo e expõe
objetos congelados para Manager API, Worker, Web e Mobile. Banco, Redis, JWT,
criptografia, S3 e SMTP possuem validadores separados. Banco é exigido pela API;
Redis é exigido pela API e pelo Worker. A matriz está em
`docs/CONFIGURATION.md`.

## Responsabilidade dos apps

| App           | Responsabilidade atual                             | Não faz neste baseline              |
| ------------- | -------------------------------------------------- | ----------------------------------- |
| `manager_api` | Config, banco, Redis, probes, OpenAPI e `/api/v1`  | Regra de negócio, auth ou permissão |
| `web`         | Valida config pública e serve o shell              | Chamada de API ou fluxo funcional   |
| `mobile`      | Valida config pública e inicia o shell Expo        | Storage, API ou fluxo de proteção   |
| `worker`      | Filas, processors, retry, logs e shutdown gracioso | Regra de negócio ou persistência    |

## Worker e filas

`packages/plugins/queues` contém o catálogo `emergency`, `notifications`,
`integrations`, `evidences` e `risk`. O BullMQ usa espera bloqueante no Redis,
sem polling de aplicação ou busy loop. Cada fila possui concorrência um por
instância neste baseline.

O produtor exige envelope de versão 1, correlação, payload JSON limitado a 16
KiB e chave de idempotência. Nome do job e chave formam um digest SHA-256 usado
como `jobId`; jobs concluídos e falhos são retidos, por isso publicar novamente
a mesma operação não cria outra execução mesmo depois de reiniciar consumers.
A semântica permanece pelo menos uma vez, e cada caso de uso futuro deve tornar
seus próprios efeitos idempotentes na fonte durável.

O `JobProcessor` cria um `requestId` por tentativa, preserva `correlationId`,
localiza o `JobUseCase` e converte `RetryableJobError` ou `TerminalJobError` para
a política do transporte. Erro não classificado, envelope inválido ou nome sem
caso de uso falha de forma terminal. A política base permite três tentativas
totais com backoff exponencial de um segundo. Falhas finais permanecem no
conjunto `failed` da fila, que funciona como dead letter inicial.

`SIGINT` e `SIGTERM` fecham primeiro os consumers, que deixam de buscar novos
jobs e aguardam o trabalho ativo. Depois o Worker fecha as conexões BullMQ e a
conexão Redis compartilhada. O catálogo, contrato completo e runbook estão em
`docs/WORKER_QUEUES.md`; a tecnologia foi registrada no `ADR-001`.

## API

O bootstrap valida ambiente, host, porta, log, CORS, banco e Redis antes de
criar o Fastify. Depois registra, nesta ordem:

1. logging seguro e headers de correlação;
2. handler global de erros e de rota inexistente;
3. registry de readiness;
4. cliente Redis e seu probe;
5. pool PostgreSQL/Drizzle;
6. parser multipart;
7. CORS;
8. i18n;
9. Swagger;
10. `GET /health` e `GET /ready`;
11. agregador vazio sob `/api/v1`.

`GET /health` verifica somente liveness e não consulta dependências.
`GET /ready` executa todos os probes obrigatórios registrados e responde 503
com `SERVICE_NOT_READY` quando um deles retorna falso ou falha. O probe Redis
exige conexão pronta e `PING` dentro do timeout. O probe `postgresql` executa
`SELECT 1` dentro dos limites do pool. Indisponibilidade e retomada de qualquer
uma das dependências são refletidas sem reiniciar a API; detalhes internos dos
probes não entram na resposta.

O processo trata `SIGINT` e `SIGTERM` por uma rotina idempotente. Ela bloqueia
readiness antes de fechar o Fastify, que para de aceitar conexões e executa os
hooks de liberação, incluindo `pool.end()`. Rotas operacionais permanecem na
raiz; o agregador versionado é a única entrada futura para rotas de negócio.

`packages/schema` concentra os schemas TypeBox, os tipos HTTP derivados, tags,
respostas comuns e o security scheme Bearer. Health e readiness referenciam
`OperationalStatus` e `ErrorResponse` em `components.schemas`. Um hook de
registro impede rota de aplicação sem `schema`, metadados, declaração explícita
de `security` e responses. A UI e os documentos HTTP ficam em `/swagger/`,
`/swagger/json` e `/swagger/yaml` somente em `LOCAL`, `DEV` e `HMG`; `PROD`
mantém apenas a geração em memória. A convenção está em
`docs/api/OPENAPI.md`.

`packages/common` expõe `ApplicationError` e as especializações para
validação, autenticação, autorização, recurso ausente, conflito, regra de
negócio, infraestrutura e indisponibilidade. Cada default possui uma
`messageKey` traduzível; mensagens de domínio podem informar uma chave específica
sem alterar código ou status. `packages/plugins` converte essas classes, erros
de schema e erros HTTP conhecidos em `{ code, message, requestId }`. O tipo
desse contrato HTTP deriva de `packages/schema`. Falhas desconhecidas recebem
`INTERNAL_SERVER_ERROR` e 500; stack, causa e detalhes do schema não são
serializados para o cliente nem mantidos como diagnóstico textual no log.

O plugin i18n resolve `Accept-Language` desde `onRequest`, respeita pesos `q`,
normaliza variantes de português para `pt-BR` e variantes regionais de inglês
ou espanhol para `en` e `es`. Locale ausente ou desconhecido usa `pt-BR`. As
respostas informam `Content-Language` e `Vary: Accept-Language`; os três
catálogos passam por teste automático de paridade e textos vazios. O contrato de
erros está em `docs/api/README.md` e a convenção de idiomas e chaves em
`docs/api/INTERNATIONALIZATION.md`.

Não há JWT, middleware de autenticação, usuário autenticado ou permissão no
baseline. Esses componentes serão redesenhados em seus tickets próprios.

## Logging e correlação

`packages/plugins/logging` concentra o Pino, sanitização recursiva, geração
de UUIDv7 e integração Fastify. Manager API e Worker escrevem JSON por linha
com `service`, `environment`, nível e evento. O nível validado em
`packages/config` é aplicado igualmente nos dois processos.

A API aceita IDs externos com formato limitado, gera valores para entradas
ausentes ou inválidas e sempre devolve `x-request-id` e `x-correlation-id`. O
evento de conclusão HTTP inclui somente método, template da rota, status e
duração; a URL bruta e os logs automáticos do Fastify ficam desabilitados. O
Worker cria um logger de job que preserva `correlationId` e gera um novo
`requestId` por tentativa. Início, conclusão, retry e falha incluem somente
fila, processor, contadores, classificação e duração; payload, `jobId`, mensagem
e causa não são registrados.

Uma denylist recursiva bloqueia payloads e dados de autenticação, pessoais, de
proteção, evidência e geolocalização. Erros conservam somente um tipo seguro;
falha de getter, ciclo ou serialização recebe marcador e não interrompe o fluxo
da aplicação. A allowlist, denylist e as consultas operacionais estão em
`docs/OBSERVABILITY.md`.

## Redis

`packages/plugins/redis` encapsula o cliente oficial, aplica automaticamente
`protege-mais:<ambiente>:` a todas as chaves expostas, limita conexão e comandos,
desabilita offline queue e agenda reconexão com backoff e jitter. A API e o
Worker usam a mesma fábrica e fecham a conexão em seus ciclos de vida.

O Compose fornece Redis local com AOF, healthcheck e volume próprio, além de uma
imagem própria para o Worker. A capacidade genérica oferece comandos mínimos de
`get`, `set`, expiração e exclusão; a capacidade de filas usa o prefixo adicional
`queues` e conexões próprias, inclusive bloqueantes. Usos permitidos e operação
estão em `docs/REDIS.md` e `docs/WORKER_QUEUES.md`.

## Web e Mobile

O Web contém uma página estática traduzida informando que a fundação está em
preparação. O Mobile contém somente o shell Expo/React Native. Nenhum dos dois
chama API, persiste token ou oferece fluxo funcional.

## Banco e Atlas

`packages/models/index.ts` é a entrada central de produção. Ele exporta
`accounts`, tipos de inserção/leitura, nomes dos índices ativos e uma projeção
que exclui hash e chaves internas. A tabela usa UUID v7 gerado na aplicação,
`TIMESTAMPTZ(3)`, timestamps comuns, versionamento otimista e soft delete. E-mail
original/normalizado, telefone E.164 e provider/subject são validados por checks;
três índices parciais resolvem unicidade entre contas ativas. `packages/common`
expõe a normalização canônica de e-mail. O dicionário está em
`docs/database/ACCOUNTS.md`.

O mesmo entrypoint exporta 14 `pgEnum` que reutilizam as tuples literais e os
types de `packages/common/enums`. Nenhum enum possui default ou regra de
transição.
`packages/models/reference` comprova mapeamento `camelCase` para `snake_case`,
nulabilidade, nomes de constraints e índices, ações de FK, unicidade parcial e
concorrência. Esse fixture não faz parte da entrada pública nem do estado
desejado de produção.

`packages/plugins/database` cria por aplicação um pool com máximo de dez
conexões, timeouts finitos, `application_name`, sessões UTC, listener seguro de
erro e fechamento idempotente. A Manager API expõe o mesmo Drizzle como
`DatabaseRw` e `DatabaseRo` e registra a conexão no readiness.

`atlas.hcl` usa o export Drizzle como estado desejado. `prod` mantém somente
migrations estruturais em `atlas/prod`; `dev` mantém apenas seeds fictícios em
`atlas/seed/dev`; `reference`, sem URL de deploy, mantém a prova executável em
`packages/models/reference/atlas`. O diretório estrutural possui a migration
idempotente que diagnostica suporte e executa
`CREATE EXTENSION IF NOT EXISTS postgis`, a migration dos 14 enums e
`20260826233758_create_accounts.sql`; o seed continua vazio. O apply não
recalcula hashes, uma base limpa aplica a estrutura sem seed e a repetição
permanece sem pendências ou drift. PostgreSQL principal e dev database do Atlas
usam `postgis/postgis:16-3.5-alpine`, iniciam em UTC, têm healthcheck, shutdown
gracioso e rede local; a porta publicada do banco é restrita a loopback. O
fluxo completo está em
`docs/database/README.md`.

## Comandos do monorepo

| Comando                                             | Resultado                                            |
| --------------------------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                                          | Inicia os quatro apps pelo Turbo                     |
| `pnpm dev:manager_api`                              | Inicia somente a API                                 |
| `pnpm dev:web`                                      | Inicia somente o Web                                 |
| `pnpm dev:mobile`                                   | Inicia somente o Mobile                              |
| `pnpm dev:worker`                                   | Inicia somente os consumers do Worker                |
| `pnpm lint`                                         | Valida os quatro apps e os dez packages              |
| `pnpm typecheck`                                    | Valida os quatro apps e os dez packages              |
| `pnpm test`                                         | Testa config, contas, enums, filas, logs e OpenAPI   |
| `pnpm --filter @protege-mais/plugins test:database` | Integra contas, enums, PostGIS, UTC e retomada       |
| `pnpm --filter @protege-mais/plugins test:redis`    | Integra Redis real, TTL e reconexão                  |
| `pnpm --filter @protege-mais/worker test:redis`     | Integra filas, retry, idempotência, falha e shutdown |
| `pnpm format:check`                                 | Confere a formatação do repositório                  |
| `pnpm -r --if-present format:check`                 | Confere a formatação por workspace                   |
| `pnpm build`                                        | Gera os quatro builds a partir da raiz               |
| `pnpm migrate:local`                                | Aplica migrations estruturais Atlas localmente       |
| `ENV=prod pnpm atlas:validate:docker`               | Valida o diretório estrutural e seu checksum         |
| `pnpm model:reference:export`                       | Exibe o DDL do fixture Drizzle                       |
| `pnpm model:reference:validate`                     | Valida a migration isolada de convenções             |
| `pnpm model:reference:diff`                         | Confirma zero drift no fixture                       |
| `pnpm -r list --depth -1`                           | Lista raiz, quatro apps e dez packages               |

## Inventário e recuperação

A classificação do legado removido permanece em
`docs/implementation/PROT-000_LEGACY_INVENTORY.md`. Os arquivos removidos são
recuperáveis pelo histórico Git; o `PROT-011` não criou tabela, migration SQL,
seed ou dado de domínio. O `PROT-012` criou somente a migration da extensão e
não adicionou tabelas de domínio. O `PROT-013` adicionou somente tabelas de
referência em um diretório e ambiente Atlas sem deploy; o schema `prod` continua
sem elas. O `PROT-014` adicionou 14 tipos enum e nenhuma tabela ou dado. O
`PROT-015` adicionou somente `accounts`, sem seed, dado, rota ou fluxo de
autenticação. A validação cria e remove somente uma base temporária com nome
reservado; os volumes locais não são apagados. O volume Redis local contém
somente metadados técnicos das filas e qualquer job fictício de teste é removido
ao concluir a integração.

---

Documentação Protege Mais — Arquitetura atual
