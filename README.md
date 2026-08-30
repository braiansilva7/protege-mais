# Protege Mais

Fundação técnica do **Protege Mais**.

O legado foi removido pelo `PROT-000`, a estrutura do monorepo foi consolidada
pelo `PROT-001`, a qualidade comum foi entregue pelo `PROT-002` e as variáveis
de ambiente foram centralizadas pelo `PROT-003`. O `PROT-004` acrescentou o
padrão global de erros da API. Neste baseline ainda não existem dados
operacionais, autenticação, autorização funcional ou rotas de negócio. API,
Worker, Web e Mobile
permanecem como shells mínimos para evolução incremental.

O `PROT-005` consolidou a internacionalização do backend em `pt-BR`, `en` e
`es`, com negociação por `Accept-Language`, fallback e catálogos equivalentes.
O `PROT-006` separou liveness de readiness, formalizou o prefixo `/api/v1` e
adicionou encerramento gracioso da Manager API.
O `PROT-007` tornou `packages/schema` a fonte oficial dos contratos HTTP,
consolidou o OpenAPI 3.1 e restringiu a exposição do Swagger por ambiente.
O `PROT-008` implantou logs JSON seguros na API e no Worker, com correlação,
rotas normalizadas e redaction defensiva.
O `PROT-009` adicionou Redis compartilhado, namespaces por ambiente, probe de
readiness, reconexão limitada e fechamento gracioso na API e no Worker.
O `PROT-010` adicionou as cinco filas do Worker, envelope versionado,
idempotência de publicação, retry/backoff, falha controlada e shutdown durante
processamento.
O `PROT-011` consolidou o pool PostgreSQL/Drizzle, readiness e shutdown do
banco, sessões UTC e o fluxo Atlas reproduzível com migrations estruturais
independentes de seed.
O `PROT-012` habilitou PostGIS por migration idempotente, fixou SRID 4326 para
dados espaciais futuros e adicionou validação real de versão e distância.
O `PROT-013` congelou as convenções de models e migrations, adicionou helpers
Drizzle reutilizáveis e uma referência isolada que comprova o fluxo Atlas sem
introduzir tabelas fictícias no schema de produção.
O `PROT-014` centralizou os enums fundamentais no TypeScript e no PostgreSQL,
com catálogo semântico, migration sem seed e testes reais de paridade e rejeição
de valores inválidos.
O `PROT-015` criou `accounts` para identidades locais e externas, com
normalização, unicidade atômica entre contas ativas, reutilização explícita após
soft delete e projeção que exclui hashes e chaves internas.
O `PROT-016` criou `auth_sessions` com hash de refresh token, metadata de
dispositivo sanitizada, expiração/revogação, integridade referencial e revogação
atômica sem persistir token ou IP em claro.
O `PROT-017` criou a fundação de RBAC contextual com papéis, permissões e
atribuições globais, organizacionais ou de unidade, sem antecipar catálogo,
vínculos ou middleware de autorização.
O `PROT-018` criou o catálogo TypeScript das 19 permissões iniciais e um seed
aditivo, idempotente e exclusivo de desenvolvimento, sem definir papéis ou
atribuições.
O `PROT-019` criou `organizations` com nomes pesquisáveis, CNPJ numérico ou
alfanumérico validado, localidade IBGE, ciclo de ativação/soft delete e a FK
organizacional do RBAC, sem antecipar cadastro HTTP ou autorização funcional.
O `PROT-020` criou `organization_units` com identidade contextual, contatos,
endereço estruturado, posição `geography(Point,4326)`, busca GiST e FK composta
do RBAC, sem antecipar cadastro, membership ou autorização funcional.
O `PROT-021` criou `organization_members` com contextos organizacionais ou de
unidade coerentes, vigência explícita, matrícula/cargo opcionais e unicidade que
também trata unidade nula como igual, sem duplicar papéis nem antecipar
autorização funcional.

## Pré-requisitos

- Node.js `24.12.0`;
- pnpm `11.9.0`;
- Docker, apenas para os tickets que usam infraestrutura local.

## Instalação

1. Copie `.env.example` para `.env` e ajuste valores locais.
2. Instale todos os workspaces com `pnpm install`.
3. Confira o grafo com `pnpm -r list --depth -1`.

O workspace contém quatro apps e dez packages compartilhados sob o namespace
`@protege-mais/`.

Cada app valida somente seu conjunto mínimo antes de iniciar. A matriz completa,
os defaults permitidos e as regras para segredos estão em
[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md). Valores de exemplo marcados
com `change-before-production` nunca devem ser usados em produção.

## Execução dos shells

Use `pnpm dev` para iniciar os quatro apps pelo Turbo ou execute cada processo
isoladamente:

```bash
pnpm dev:manager_api
pnpm dev:web
pnpm dev:mobile
pnpm dev:worker
```

O Worker conecta ao Redis e aguarda, sem busy loop, jobs nas filas `emergency`,
`notifications`, `integrations`, `evidences` e `risk`. `SIGINT` e `SIGTERM`
interrompem novas coletas, aguardam o job ativo e fecham todas as conexões. O
catálogo, envelope e runbook estão em
[`docs/WORKER_QUEUES.md`](docs/WORKER_QUEUES.md).

Para iniciar as dependências locais da API:

```bash
docker compose up -d --wait db redis atlas-db
pnpm migrate:local
```

A convenção de chaves, timeouts, readiness, usos permitidos e operação local
estão em [`docs/REDIS.md`](docs/REDIS.md). O setup PostgreSQL, os limites do
pool e o fluxo Atlas estão em [`docs/database/README.md`](docs/database/README.md).

## Qualidade e build

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Lint e typecheck cobrem os quatro apps e os dez packages. Os testes atuais
cobrem configuração, erros, i18n, PostgreSQL, Redis, registry de readiness,
endpoints operacionais, OpenAPI, logging, redaction, correlação, filas e
shutdown, além das convenções, enums, contas, sessões, RBAC e catálogo de
permissões, organizações, unidades espaciais e memberships em Drizzle/Atlas; o
build cobre Manager API, Worker, Web e Mobile. Depois de subir as dependências
locais, as integrações reais são executadas com
`pnpm --filter @protege-mais/plugins test:database`,
`pnpm --filter @protege-mais/plugins test:redis` e
`pnpm --filter @protege-mais/worker test:redis`. Use `pnpm format` para aplicar a
formatação e `pnpm -r --if-present format:check` para conferir cada workspace
explicitamente.
As regras de TypeScript, ESLint, Prettier e uso excepcional de `any` estão em
[`docs/QUALITY.md`](docs/QUALITY.md).

## Estado atual da API

- `GET /health` — liveness do processo, sem consultar dependências;
- `GET /ready` — readiness das dependências obrigatórias registradas;
- `/swagger/` — UI do OpenAPI em `LOCAL`, `DEV` e `HMG`; bloqueada em `PROD`;
- `/api/v1` — reservado para futuras rotas de negócio, atualmente vazio.

Falhas HTTP usam o contrato comum `{ code, message, requestId }`; `message` é
traduzida sem alterar `code`, enquanto stack, causa e detalhes de validação não
fazem parte da resposta. A tabela de mapeamentos e as regras de uso estão em
[`docs/api/README.md`](docs/api/README.md), que também descreve os probes e o
shutdown; idiomas e convenção de chaves estão em
[`docs/api/INTERNATIONALIZATION.md`](docs/api/INTERNATIONALIZATION.md), e a
convenção completa do OpenAPI está em
[`docs/api/OPENAPI.md`](docs/api/OPENAPI.md). Os headers de correlação, campos
permitidos/proibidos e consultas operacionais estão em
[`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

PostgreSQL/PostGIS e Atlas formam a fundação oficial de persistência. O schema
de domínio possui `accounts`, `auth_sessions`, `organizations`,
`organization_units`, `organization_members`, `roles`, `permissions`,
`role_permissions`, `account_roles` e 14 tipos enum fundamentais. As migrations
estruturais recriam esse estado vazio em uma base limpa; o seed opcional de
desenvolvimento adiciona somente 19 permissões.
As convenções, os dicionários, o catálogo e o checklist estão em
[`docs/database/CONVENTIONS.md`](docs/database/CONVENTIONS.md),
[`docs/database/ACCOUNTS.md`](docs/database/ACCOUNTS.md),
[`docs/database/AUTH_SESSIONS.md`](docs/database/AUTH_SESSIONS.md),
[`docs/database/ORGANIZATIONS.md`](docs/database/ORGANIZATIONS.md),
[`docs/database/ORGANIZATION_UNITS.md`](docs/database/ORGANIZATION_UNITS.md),
[`docs/database/ORGANIZATION_MEMBERS.md`](docs/database/ORGANIZATION_MEMBERS.md),
[`docs/database/ENUM_CATALOG.md`](docs/database/ENUM_CATALOG.md) e
[`docs/database/MIGRATION_CHECKLIST.md`](docs/database/MIGRATION_CHECKLIST.md).
O diagrama RBAC, o dicionário das quatro tabelas e a semântica dos escopos estão
em [`docs/permissions/README.md`](docs/permissions/README.md).

## Documentação e tickets

- Índice: [`docs/README.md`](docs/README.md)
- Roadmap: [`docs/product/ROADMAP.md`](docs/product/ROADMAP.md)
- Tickets: [`docs/tickets/README.md`](docs/tickets/README.md)
- Arquitetura atual:
  [`docs/PROJECT_ARCHITECTURE.md`](docs/PROJECT_ARCHITECTURE.md)
- Arquitetura-alvo:
  [`docs/architecture/TARGET_ARCHITECTURE.md`](docs/architecture/TARGET_ARCHITECTURE.md)

O próximo ticket liberado é `PROT-022`:

```text
Implemente o ticket PROT-022 seguindo toda a documentação do projeto.
```
