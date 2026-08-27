# Registro de implementação

Este arquivo registra somente mudanças efetivamente realizadas. Planos futuros
ficam no roadmap e nos tickets.

## 2026-08-26 — PROT-016 — Criar tabela auth_sessions

Status: Concluído

### Resultado

`auth_sessions` passa a persistir o hash opaco do refresh token e os metadados
mínimos de dispositivo vinculados a `accounts`. O ciclo de vida é derivado de
expiração e revogação; token e IP em claro não fazem parte do schema, e as
projeções de consulta excluem hashes e ownership interno.

Checks nomeados protegem identificador, metadata sanitizada, timestamps e
versão. A busca por hash é única, o índice composto cobre o ciclo por conta e a
revogação condicionada por atividade/versão garante apenas uma vencedora sob
concorrência. A FK restritiva preserva sessões quando a conta sofre soft delete
e impede hard delete silencioso do histórico.

### Arquivos e dados

- criado `packages/common/auth-sessions` com sanitização e limites de nome do
  dispositivo e User-Agent por code point, acompanhado por dois testes;
- criado `packages/models/auth-sessions.ts` com 13 colunas, UUID v7 gerado na
  aplicação, `TIMESTAMPTZ(3)`, optimistic locking, sete checks, FK
  `ON UPDATE NO ACTION`/`ON DELETE RESTRICT`, dois índices, predicado de atividade
  e projeção/serialização segura;
- gerada por diff real a migration estrutural
  `20260827001526_create_auth_sessions.sql`, sem seed, dado, default de UUID,
  status materializado, soft delete ou operação destrutiva; o checksum Atlas foi
  atualizado;
- adicionados cinco testes de model/migration e três integrações PostgreSQL
  reais para atividade/expiração, projeção, constraints, integridade
  referencial, planos de índice e revogação concorrente;
- criado `docs/database/AUTH_SESSIONS.md` com dicionário, ciclo de vida,
  consultas, retenção e fronteiras de segurança; README, arquitetura,
  privacidade, qualidade, banco, roadmap, índices e tickets foram sincronizados;
- nenhuma versão de dependência ou lockfile foi alterada; não foram criados
  rota, repositório, seed, dado, algoritmo de hash, emissão, rotação ou reuso de
  token.

### Validação

- migration completa em base temporária criada de `template0`: quatro
  migrations e 23 instruções aplicadas; segunda execução sem pendências; 14
  tipos, 55 labels, `accounts` e `auth_sessions`, esta com 13 colunas, sete
  checks, dois índices secundários e zero registros; a base foi removida ao
  final;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, versão `20260827001526`, quatro arquivos executados, zero pendências e
  zero drift;
- `pnpm model:reference:validate` e `pnpm model:reference:diff`: fixture de
  convenções válido e sem drift;
- `pnpm --filter @protege-mais/plugins test:database`: 11 testes reais
  aprovados, incluindo os três cenários de sessão e os baselines de contas,
  enums, Drizzle/UTC, PostGIS/SRID/distância e retomada/shutdown;
- `pnpm test`: 88 testes aprovados em sete workspaces;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB;
- `docker compose config --quiet`: configuração válida.

### Decisões e pendências

- atividade não possui status armazenado: exige `revoked_at IS NULL` e
  `expires_at > :now`; elegibilidade da conta continua uma verificação separada;
- o hash corrente é globalmente único; um índice temporal parcial não foi usado
  porque a passagem do tempo alteraria atividade sem mutar a linha;
- sessões não recebem soft delete; revogação é o encerramento operacional, e
  retenção/expurgo dependem de política jurídica e operacional futura;
- nenhum ADR novo: o ticket materializa o contrato aprovado usando as
  convenções vigentes; algoritmo de hash, rotação, família/histórico para reuso,
  logout e gestão HTTP permanecem nos tickets de autenticação;
- `PROT-017` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-015 — Criar tabela accounts

Status: Concluído

### Resultado

`accounts` inaugura o schema de domínio com identidades de acesso separadas de
perfis. O model persiste identidade local por e-mail/hash, identidade externa
por provider/subject ou ambas, além de telefone E.164, tipo/status explícitos,
MFA, último login, timestamps, versão e soft delete.

Checks nomeados rejeitam combinações incoerentes e três índices únicos parciais
arbitram atomicamente e-mail, telefone e principal externo entre contas ativas.
Identificadores são liberados após soft delete; uma restauração conflita se o
valor tiver sido reutilizado. A projeção de saída exclui hash, chave normalizada,
subject externo e marcador de exclusão.

### Arquivos e dados

- criado `packages/common/accounts` com normalização determinística de e-mail
  por trim/lowercase e dois testes de idempotência/comportamento;
- criado `packages/models/accounts.ts` com 15 colunas, UUID v7 gerado na
  aplicação, `TIMESTAMPTZ(3)`, optimistic locking, seis checks nomeados, três
  índices únicos parciais e tipos/projeção públicos;
- gerada por diff real a migration estrutural
  `20260826233758_create_accounts.sql`, sem seed, dado, default de UUID ou
  default de tipo/status/MFA; o checksum Atlas foi atualizado;
- adicionados quatro testes de model/migration e quatro integrações PostgreSQL
  reais para persistência válida, serialização segura, checks, plano de consulta,
  conflitos, concorrência e reutilização;
- criado `docs/database/ACCOUNTS.md` com o dicionário de dados, métodos de
  identidade, integridade, segurança e fronteiras do ticket;
- criado o `ADR-004` para registrar unicidade parcial, reutilização após soft
  delete e conflito explícito de restauração; README, arquitetura, qualidade,
  banco, catálogo, roadmap, índices e tickets foram sincronizados;
- nenhuma versão de dependência ou lockfile foi alterada; não foram criados
  rota, repositório, seed, dado, permissão, algoritmo de senha ou fluxo de auth.

### Validação

- migration completa em base temporária criada de `template0`: três migrations
  e 20 instruções aplicadas; segunda execução sem pendências; 14 tipos, 55 labels,
  uma tabela `accounts` com 15 colunas, três índices ativos e zero registros; a
  base foi removida ao final;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, versão `20260826233758`, zero pendências e zero drift;
- `pnpm model:reference:validate` e `pnpm model:reference:diff`: fixture de
  convenções válido e sem drift;
- `pnpm --filter @protege-mais/plugins test:database`: oito testes reais
  aprovados, incluindo os quatro cenários de conta, paridade dos enums,
  Drizzle/UTC, PostGIS/SRID/distância e retomada/shutdown;
- `pnpm test`: 81 testes aprovados em sete workspaces;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB;
- `docker compose config --quiet`: configuração válida.

### Decisões e pendências

- `external_subject` acompanha o provider porque o nome do provider sozinho
  não identifica um principal externo;
- telefone é identificador de contato neste ticket, não método de autenticação
  isolado;
- e-mail, telefone, hash e subject externo não entram em logs; conflitos futuros
  devem ser mapeados por SQLSTATE/nome do índice sem propagar o detail do driver;
- verificação de posse, hash de senha, login, sessão, MFA, autorização, retenção
  e hard delete permanecem nos tickets próprios;
- `PROT-016` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-014 — Criar enums fundamentais

Status: Concluído

### Resultado

Os 14 enums fundamentais agora possuem uma fonte imutável compartilhada no
TypeScript, definições `pgEnum` equivalentes no Drizzle e tipos nativos no
PostgreSQL. O catálogo cobre identidade, organização, proteção, risco,
incidentes, termos de medida protetiva, emergência, evidência e notificação
sem criar tabelas, defaults, permissões ou máquinas de estado antecipadas.

O banco permanece como garantia final contra labels inválidos. Testes unitários
e uma integração PostgreSQL real protegem a ordem e a paridade dos 55 labels
entre catálogo, Drizzle, migration e schema aplicado.

### Arquivos e dados

- criado `packages/common/enums/index.ts` com tuples literais congeladas, tipos
  derivados e o catálogo central dos 14 nomes PostgreSQL;
- criado `packages/models/enums.ts` com um `pgEnum` distinto por conceito e sem
  cópia local dos values; as entradas públicas de `common` e `models` concentram
  todos os exports;
- gerada por diff real a migration estrutural
  `20260826231424_fundamental_enums.sql`, com 14 `CREATE TYPE`, 55 labels e
  nenhuma tabela ou dado; o checksum Atlas foi atualizado;
- adicionados cinco testes unitários/contratuais para conjunto aprovado,
  imutabilidade, nomes, derivação de tipos, paridade Drizzle/migration e ausência
  de tabela ou seed;
- ampliada a integração PostgreSQL com introspecção de `pg_type`/`pg_enum`,
  inserção válida e rejeição individual de label inválido com SQLSTATE
  `22P02`;
- criado `docs/database/ENUM_CATALOG.md` com a semântica inicial e a estratégia
  de evolução; convenções, checklist, guia de banco, arquitetura, qualidade,
  roadmap, índices e READMEs foram sincronizados;
- criado o `ADR-003` para registrar enums PostgreSQL nativos, fonte TypeScript
  única, separação entre conceitos e evolução forward/expand-contract;
- nenhuma versão de dependência ou lockfile foi alterada.

### Validação

- migration completa em base temporária criada de `template0`: duas migrations
  e 16 instruções aplicadas; segunda execução sem pendências; 14 tipos, 55
  labels e zero tabelas de domínio; a base foi removida ao final;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, versão `20260826231424`, zero pendências e zero drift;
- `pnpm model:reference:validate` e `pnpm model:reference:diff`: fixture de
  convenções válido e sem drift;
- `pnpm --filter @protege-mais/plugins test:database`: quatro testes reais
  aprovados, incluindo paridade dos enums, inserts inválidos, Drizzle/UTC,
  PostGIS/SRID/distância e retomada/shutdown;
- `pnpm test`: 75 testes aprovados em sete workspaces;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB;
- `docker compose config --quiet`: configuração válida.

### Decisões e pendências

- o `ADR-003` impede dependência de ordinal, duplicidade de arrays e uso de um
  enum genérico para conceitos que evoluem separadamente;
- adicionar label exige migration antes do produtor; remoção ou mudança
  incompatível exige tipo substituto, mapeamento explícito e expand/contract;
- transições, defaults, autorização e regras jurídicas continuam nos tickets
  consumidores;
- `PROT-015` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-013 — Definir convenções de tabelas e migrations

Status: Concluído

### Resultado

As convenções de persistência foram congeladas antes das tabelas de domínio:
banco em `snake_case`, TypeScript em `camelCase`, UUID v7 gerado pela aplicação,
instantes UTC em `TIMESTAMPTZ(3)`, nomes determinísticos de constraints e
índices, nulabilidade deliberada, unicidade no banco, optimistic locking e soft
delete opt-in.

Helpers Drizzle reutilizáveis materializam as colunas comuns. Um fixture com
duas tabelas e migration Atlas comprova o contrato sem entrar no export nem no
histórico de produção. Seu ambiente Atlas é isolado e não possui URL de deploy;
o schema de domínio continua sem tabelas, enums, seeds ou dados.

### Arquivos e dados

- criado `packages/models/columns.ts` com helpers para primary key UUID v7,
  `created_at`, `updated_at`, `version` e `deleted_at`; a entrada pública de
  `packages/models` exporta somente esses helpers, não o fixture;
- criado `packages/models/reference` com mapeamento camel/snake, coluna nullable,
  FK e ações explícitas, unique/check constraints, índice de FK, unicidade
  parcial para registros ativos, versionamento otimista e soft delete;
- gerada por diff real a migration isolada
  `20260826225016_conventions_reference.sql`, com checksum Atlas versionado e
  sem default UUID no banco;
- adicionado `drizzle.reference.config.ts`, o ambiente Atlas `reference` sem
  deploy e scripts para exportar, validar e detectar drift no exemplo;
- adicionados quatro testes automatizados do model e da migration, incluindo
  UUID v7, `TIMESTAMPTZ(3)`, nulabilidade, nomes e ações de integridade;
- criados o guia normativo `docs/database/CONVENTIONS.md`, o checklist
  `docs/database/MIGRATION_CHECKLIST.md` e o `ADR-002`; README, arquitetura
  atual, qualidade, banco, roadmap, índices e ticket foram sincronizados;
- `audit_logs`, `alert_events` e `risk_assessments` foram excluídos
  explicitamente de qualquer soft delete automático; migrations de produção
  continuam independentes de seed;
- nenhuma versão de dependência foi atualizada; Drizzle, `tsx` e tipos Node já
  presentes no lockfile apenas passaram a ser declarados pelo workspace de
  models.

### Validação

- `pnpm model:reference:export`: DDL gerado com UUID sem default de banco,
  `TIMESTAMPTZ(3)`, mapeamento snake/camel e objetos nomeados;
- `pnpm model:reference:validate` e `pnpm model:reference:diff`: checksum válido
  e diretório sincronizado, sem drift;
- migration de referência em base temporária criada de `template0`: FK,
  check de versão e duplicidade ativa foram rejeitados pelos nomes esperados;
  soft delete permitiu reutilização da chave; update com versão obsoleta afetou
  zero linhas; sessão permaneceu em UTC e a base foi removida;
- `pnpm migrate:local`, `atlas migrate validate`, `status` e `diff` em `prod`:
  versão `20260826000000`, zero pendências e zero drift; as tabelas do fixture
  não entraram no schema principal;
- `pnpm test`: 70 testes aprovados em sete workspaces, incluindo os quatro
  testes novos de models;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm --filter @protege-mais/plugins test:database`: três testes reais
  aprovados para Drizzle/UTC, PostGIS/SRID/distância e retomada/shutdown;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB;
- `docker compose config --quiet`: configuração válida.

### Decisões e pendências

- o `ADR-002` registra a geração de UUID pela aplicação, precisão temporal,
  integridade nomeada, optimistic locking, soft delete opt-in, migrations
  forward-only e isolamento do fixture;
- `updated_at` é atualizado automaticamente nas operações Drizzle que usam o
  helper; SQL manual precisa definir `updated_at = now()` explicitamente;
- retenção, restauração, exceções de concorrência e efeitos de exclusão
  continuam obrigatoriamente explícitos nos tickets de cada entidade;
- `PROT-014` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-012 — Habilitar e validar PostGIS

Status: Concluído

### Resultado

PostGIS agora está disponível no PostgreSQL principal e no banco de
desenvolvimento do Atlas. A primeira migration estrutural verifica se o
servidor oferece a extensão, falha com diagnóstico acionável quando não oferece
e executa `CREATE EXTENSION IF NOT EXISTS postgis` sem depender de seed.

A integração real detecta as versões instalada e carregada, confirma SRID 4326
e valida uma distância geodésica conhecida em metros. O schema Drizzle continua
sem entidades de domínio; tabelas, constraints e índices espaciais permanecem
nos tickets consumidores.

### Arquivos e dados

- `db` e `atlas-db` passaram de `postgres:16-alpine` para a imagem oficial
  publicada `postgis/postgis:16-3.5-alpine`, preservando PostgreSQL 16, UTC,
  volumes, healthchecks e rede local;
- criada `atlas/prod/20260826000000_enable_postgis.sql`, com preflight em
  `pg_available_extensions`, SQLSTATE `0A000`, mensagem e `HINT` seguros, além
  do `CREATE EXTENSION IF NOT EXISTS`; o checksum `atlas.sum` foi recalculado;
- ampliada a integração de banco com detecção em `pg_extension`,
  `PostGIS_Lib_Version()`, SRID 4326 e `ST_Distance` sobre `geography`;
- documentadas imagem obrigatória, migração de volumes existentes, diagnóstico
  sem suporte, estratégia sem `DROP EXTENSION`, ordem longitude/latitude,
  limites, unidade em metros e proibição de coordenadas em logs;
- README, arquitetura atual, qualidade, guia de banco, roadmap, models e índices
  de tickets foram sincronizados;
- nenhuma tabela, enum, seed, rota, permissão ou dado de domínio foi criado. O
  objeto `spatial_ref_sys` pertence e é gerenciado pela extensão.

### Validação

- manifest do tag `postgis/postgis:16-3.5-alpine`: publicado e compatível com a
  arquitetura local;
- `pnpm migrate:local`: habilitou PostGIS em um volume PostgreSQL 16 existente
  que ainda não possuía a extensão; nova execução terminou sem migrations
  pendentes;
- base limpa criada de `template0`: a migration foi aplicada duas vezes, com
  uma única extensão PostGIS `3.5.7`, SRID `4326` e distância
  `111319.491` metros; a base temporária foi removida ao final;
- PostgreSQL `16-alpine` sem os arquivos de PostGIS: apply rejeitado com
  `ERROR` e `HINT` explícitos, sem criar a extensão; o container temporário foi
  removido;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, versão atual `20260826000000`, zero pendências e zero drift;
- `pnpm --filter @protege-mais/plugins test:database`: três testes reais
  aprovados para Drizzle/UTC, PostGIS/SRID/distância e queda/retomada/shutdown;
- `pnpm test`: 66 testes aprovados em seis workspaces;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB;
- `docker compose config --quiet`: configuração válida.

### Decisões e pendências

- nenhum ADR adicional foi necessário: PostGIS, SRID 4326 e a fronteira Atlas
  já estavam aprovados na arquitetura-alvo e no ticket;
- não existe rollback automático com `DROP EXTENSION`, pois se tornará uma
  operação destrutiva quando tabelas espaciais dependerem do PostGIS;
- constraints, índices, nulabilidade, concorrência, soft delete e model de
  referência permanecem no `PROT-013`, próximo ticket liberado;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-011 — Consolidar PostgreSQL, Drizzle e Atlas

Status: Concluído

### Resultado

A Manager API agora usa uma conexão PostgreSQL gerenciada, um pool limitado por
aplicação e o schema central do Drizzle. Cada sessão inicia em UTC; conexão,
queries e transações ociosas possuem limites; erros de pool são tratados sem
credenciais. O probe obrigatório `postgresql` fecha readiness durante falha e a
reabre quando uma nova conexão funciona, enquanto liveness permanece isolada.
O shutdown é idempotente e aguarda `pool.end()`.

O Atlas usa o export Drizzle como estado desejado e mantém estrutura em
`atlas/prod` separada dos dados fictícios em `atlas/seed/dev`. Apply não
reescreve checksum, migration não depende de seed e ambos os diretórios têm um
baseline vazio válido. O Compose executa PostgreSQL principal e dev database em
UTC, com healthcheck, parada graciosa e porta local restrita a loopback.

### Arquivos e dados

- consolidado `packages/plugins/database` com fábrica injetável, pool máximo de
  dez conexões, timeouts, `application_name`, sessões UTC, Drizzle tipado,
  eventos seguros, readiness, retomada e fechamento idempotente;
- a Manager API passou a injetar a conexão em testes e registrar o probe
  `postgresql`; `DatabaseRw` e `DatabaseRo` compartilham o mesmo pool até uma
  decisão explícita sobre réplica de leitura;
- `packages/models/index.ts` foi confirmado como export central e permaneceu
  vazio, sem antecipar enums, tabelas ou convenções do `PROT-013`;
- `atlas.hcl` passou a consumir URLs somente pelo ambiente, executar o binário
  local do Drizzle fixado no lockfile e separar os ambientes `prod` e `dev`;
- scripts Atlas agora separam diff/hash/validate/status de apply; `migrate`
  estrutural permanece independente de `seed`, e os dois diretórios ganharam
  `atlas.sum` de conteúdo vazio;
- a imagem local fixa Atlas `v1.3.0`; o Compose ganhou UTC efetivo, healthcheck
  do `atlas-db`, dependência saudável e bind PostgreSQL em `127.0.0.1`;
- `reflect-metadata` `0.2.2`, já resolvido no monorepo, tornou o package de
  plugins autocontido sem atualizar bibliotecas existentes;
- adicionados testes unitários e reais de configuração do pool, consulta
  Drizzle, UTC, conexão inválida, logs sem credenciais, readiness, queda,
  retomada e shutdown;
- README, configuração, segurança, observabilidade, API, qualidade, arquitetura,
  roadmap e guia de banco foram sincronizados;
- nenhuma tabela, migration SQL, seed, permissão, rota ou dado de domínio foi
  criado. A base temporária exclusiva da validação foi removida; nenhum volume
  local foi apagado.

### Validação

- `pnpm test`: 66 testes aprovados em seis workspaces;
- `pnpm --filter @protege-mais/plugins test:database`: dois testes contra
  PostgreSQL real, cobrindo Drizzle, UTC, queda, retomada por novo socket e
  fechamento;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes Redis reais
  aprovados, e `pnpm --filter @protege-mais/worker test:redis`: pipeline real do
  Worker aprovado;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`, com variáveis públicas locais fictícias: Manager API, Worker,
  Web e Mobile gerados; permanece somente o aviso não bloqueante já conhecido
  do bundle Web maior que 500 kB;
- `docker compose config --quiet`, builds das imagens Atlas e Manager API e
  smoke da imagem da API: configuração válida, Atlas `v1.3.0`, readiness 200 e
  fechamento de PostgreSQL/Redis por sinal;
- `atlas migrate validate` nos ambientes `prod` e `dev` e `atlas migrate diff`
  em `prod`: checksums válidos e estado desejado sincronizado;
- base limpa exclusiva: apply estrutural executado duas vezes, zero migrations
  pendentes, `SELECT 1` aprovado, timezone `UTC`, zero tabelas de domínio e
  remoção da base ao final; `migrate:local`, `seed:local` vazio e status também
  aprovados;
- prova ponta a ponta da API: `/ready` retornou 200, passou a 503 durante a
  parada do PostgreSQL e voltou a 200 após a retomada sem reinício; `/health`
  permaneceu 200 e as respostas/logs não exibiram credenciais;
- `pnpm audit --prod --audit-level high`: manteve o baseline conhecido de 13
  achados, sendo dez altos e três moderados; nenhuma versão existente foi
  atualizada fora do escopo.

### Decisões e pendências

- nenhum ADR adicional foi necessário: PostgreSQL, Drizzle, Atlas, a separação
  estrutura/seed e a fronteira em `packages/plugins` já estavam aprovados na
  arquitetura-alvo e no próprio ticket;
- o alerta conhecido do Drizzle para identificadores SQL permanece no baseline
  de dependências; este ticket usa somente SQL estático e uma atualização exige
  o ticket dedicado já recomendado pela auditoria;
- PostGIS pertence ao `PROT-012`; convenções detalhadas, model de referência e
  política de migrations pertencem ao `PROT-013`;
- `PROT-012` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-010 — Criar infraestrutura do Worker

Status: Concluído

### Resultado

O Worker agora aguarda sem busy loop as filas `emergency`, `notifications`,
`integrations`, `evidences` e `risk`. O pipeline separa produtor BullMQ,
processor e caso de uso; publica envelope v1 limitado e correlacionado; aplica
idempotência por `jobId` opaco, três tentativas com backoff exponencial e falha
terminal controlada. Jobs finalizados permanecem disponíveis para deduplicação
e operação.

Cada tentativa cria um `requestId`, preserva `correlationId` e registra somente
fila, processor, contadores, duração e classificação. O shutdown deixa de buscar
novos jobs, aguarda o trabalho ativo e fecha consumers e conexões Redis. Nenhuma
regra de negócio foi adicionada ao processor.

### Arquivos e dados

- criado `packages/plugins/queues` com catálogo fixo, prefixo Redis por
  ambiente, envelope de até 16 KiB, validação de JSON/campos proibidos, hash
  SHA-256 da chave de idempotência, produtor, inspeção, retry/backoff e pool de
  consumers;
- criado `packages/useCases/jobs` com contrato de execução, contexto
  correlacionado, registry e erros explícitos `RetryableJobError` e
  `TerminalJobError`;
- o Worker ganhou `JobProcessor`, logger de tentativa, composição das cinco
  filas, eventos seguros de sucesso/retry/falha e fechamento ordenado durante
  `SIGINT` ou `SIGTERM`;
- criado `apps/worker/Dockerfile`; o Compose ganhou o serviço `worker`,
  dependente do Redis saudável e com `init` para propagação de sinais;
- BullMQ `6.3.0` e `tslib` `2.8.1`, versões mais recentes consultadas no
  registro, foram adicionados somente a `packages/plugins`; o adaptador oficial
  reutiliza `redis` `6.2.1` sem introduzir `ioredis` ou atualizar dependências
  existentes;
- o pnpm passou a permitir explicitamente a versão nova do BullMQ pela política
  de idade mínima e a negar o build opcional de `msgpackr-extract`; o fallback
  JavaScript foi validado nos testes, build e container;
- adicionados testes unitários de catálogo, envelope, payload sensível,
  idempotência, registry, delegação, correlação e classificação de falhas, além
  da integração real de fila/processor/use case, retry/backoff, reinício, falha
  terminal e shutdown com job ativo;
- criados `docs/WORKER_QUEUES.md` e
  `docs/decisions/ADR-001-bullmq-redis-queues.md`; README, arquitetura atual,
  Redis, observabilidade, qualidade, roadmap e índices foram sincronizados;
- nenhuma tabela, migration, seed, permissão, rota, evento de domínio ou payload
  real foi criado. A integração remove seus jobs fictícios; permanecem somente
  metadados operacionais do BullMQ no Redis local.

### Validação

- `pnpm test`: 61 testes aprovados em seis workspaces;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes aprovados para
  namespace, set/get, TTL, indisponibilidade e retomada do Redis real;
- `pnpm --filter @protege-mais/worker test:redis`: integração aprovada para
  processamento único, deduplicação após reinício, três tentativas com backoff
  reduzido, falha terminal observável e shutdown aguardando job ativo;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem warnings
  ou erros;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`, com variáveis públicas locais fictícias: Manager API, Worker,
  Web e Mobile gerados; permanece somente o aviso não bloqueante já conhecido
  do bundle Web maior que 500 kB;
- `docker compose config --quiet` e `docker compose build worker`: configuração
  válida e imagem do Worker construída com lockfile congelado;
- smoke do container: o Worker conectou, registrou `worker.ready`, recebeu
  `SIGTERM`, fechou Redis, registrou `worker.stopped` e terminou com código 0;
- `pnpm audit --prod --audit-level high`: manteve o baseline conhecido de 13
  achados, sendo 10 altos e três moderados, sem caminho novo pelo BullMQ; versões
  existentes não foram alteradas fora do escopo.

### Decisões e pendências

- `ADR-001` aprovou BullMQ sobre Redis, o adaptador `node-redis`, as cinco filas,
  retenção dos jobs finalizados e o conjunto `failed` como dead letter inicial;
- cada domínio futuro ainda deve definir idempotência durável do efeito,
  retenção, monitoramento e ferramenta aprovada de reprocessamento antes de
  produção;
- a consistência entre gravação durável e publicação, inclusive outbox para
  emergência, permanece no ticket que implementar o respectivo fluxo;
- `PROT-011` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-009 — Configurar Redis

Status: Concluído

### Resultado

Manager API e Worker agora compartilham um cliente Redis com namespace por
ambiente, conexão e comandos limitados por timeout, offline queue desabilitada,
reconexão com backoff e fechamento idempotente. A API registra o Redis como
probe obrigatório: readiness responde 503 durante indisponibilidade e volta a
200 após a reconexão, sem afetar liveness.

O contrato oferece `get`, `set`, escrita com expiração, expiração posterior e
exclusão. Todas as chaves recebem automaticamente
`protege-mais:<ambiente>:`. Nenhuma URL, credencial, chave, valor ou mensagem
original do cliente entra nos eventos seguros de conexão.

### Arquivos e dados

- criado `packages/plugins/redis` com cliente gerenciado, integração Fastify,
  comandos compartilhados, namespace, timeouts, backoff, readiness e lifecycle;
- Manager API e Worker passaram a exigir `REDIS_URL`; a validação aceita
  `redis://` e `rediss://`, database numérico opcional, rejeita query, fragment e
  credencial de exemplo em produção;
- a Manager API registra o plugin depois do registry de readiness e fecha Redis
  pelo hook `onClose`; o Worker inicia a mesma conexão e a fecha em seu bloco de
  encerramento, inclusive quando a espera por sinal falha;
- o Compose ganhou `redis:8.10.0-alpine`, AOF `everysec`, healthcheck, volume
  próprio, porta restrita a `127.0.0.1` e dependência saudável da Manager API;
- o cliente oficial `redis` `6.2.1`, versão mais recente consultada no registro,
  foi adicionado a `packages/plugins`; manifests, aliases e lockfile foram
  sincronizados;
- adicionados testes unitários de namespace, backoff, plugin, readiness,
  retomada, shutdown e não vazamento, além de integração real para set/get, TTL
  e reconexão após queda simulada;
- criado `docs/REDIS.md`; README, configuração, arquitetura atual, segurança,
  observabilidade, API, qualidade, roadmap e índices foram atualizados;
- nenhuma tabela, migration, seed, permissão, rota de negócio ou dado de domínio
  foi criado. As chaves de integração expiraram ou foram removidas.

### Validação

- `pnpm test`: 50 testes aprovados em cinco workspaces;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes aprovados contra
  Redis real, cobrindo namespace, set/get, TTL, indisponibilidade e retomada;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem warnings
  ou erros;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`, com variáveis públicas locais fictícias: Manager API, Worker,
  Web e Mobile gerados; permanece somente o aviso não bloqueante já conhecido
  do bundle Web maior que 500 kB;
- `docker compose config --quiet` e healthcheck `redis-cli ping`: configuração e
  serviço local aprovados;
- `docker compose build manager_api`: imagem gerada com instalação por lockfile
  congelado e cliente Redis presente no runtime;
- smoke dos artefatos compilados: API e Worker conectaram ao Redis real,
  encerraram a conexão por sinal e finalizaram com código 0;
- prova ponta a ponta de readiness: 200 com Redis disponível, 503 após a queda e
  200 após retomada automática, sem reinício da API.

### Decisões e pendências

- nenhum ADR adicional foi necessário: Redis e sua fronteira em
  `packages/plugins` já estavam aprovados na arquitetura-alvo; o cliente Node é
  um detalhe substituível dessa implementação;
- filas, processors, contratos de job, retry e idempotência permanecem no
  `PROT-010`;
- o probe PostgreSQL permanece no `PROT-011`;
- `PROT-010` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-25 — PROT-008 — Implantar logging estruturado e seguro

Status: Concluído

### Resultado

Manager API e Worker agora emitem um objeto JSON por linha com serviço,
ambiente, nível e evento. Cada requisição aceita ou gera `requestId`, recebe um
`correlationId` e devolve ambos nos headers; o registro de conclusão contém
somente método, template da rota, status e duração.

Uma allowlist operacional e uma denylist recursiva impedem o registro de
request bruto, URL, payload, segredos, PII, dados de proteção, evidências e
geolocalização. Erros conservam apenas tipo e código seguros; ciclos, getters
hostis e valores não serializáveis recebem marcadores sem interromper a
aplicação. O Worker cria um novo `requestId` por tentativa futura de job e
preserva o `correlationId` publicado pela API.

### Arquivos e dados

- criado `packages/plugins/logging` com contrato de correlação, geração UUIDv7,
  logger Pino compartilhado, sanitização defensiva e plugin Fastify;
- a Manager API passou a desabilitar o request log automático que continha URL
  bruta, registrar o plugin antes dos demais, normalizar rotas e devolver
  `x-request-id` e `x-correlation-id` em todas as respostas;
- o handler global deixou de serializar mensagem, stack e causa de erros 5xx;
  os bootstraps da API e do Worker também passaram a emitir falhas sanitizadas
  em JSON;
- o Worker foi separado em composição, lifecycle e entrypoint, recebeu logger
  injetável para teste e a fronteira `createWorkerJobLogger` para jobs futuros;
- adicionados testes de IDs aceitos/gerados, propagação API/worker, sucesso e
  erro HTTP, template de rota, ciclo de vida do Worker, serialização hostil e
  redaction de token, CPF, endereço, relato e coordenadas;
- criada `docs/OBSERVABILITY.md` com campos permitidos/proibidos, headers,
  propagação e consultas `jq`; README, arquitetura atual, segurança, API,
  qualidade, configuração, guia de rotas, roadmap e índices foram atualizados;
- Pino `10.3.1`, já resolvido indiretamente no lockfile, passou a ser dependência
  direta de `packages/plugins`; nenhuma versão resolvida foi alterada;
- nenhuma migration, seed, tabela, permissão, rota de negócio ou dado foi criado
  ou alterado.

### Validação

- `pnpm install --frozen-lockfile --offline`: os 15 projetos permaneceram
  sincronizados sem download;
- `pnpm test`: 43 testes aprovados em cinco workspaces, incluindo captura de
  logs JSON em sucesso/erro, correlação, redaction e falha de serialização;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem warnings
  ou erros;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`, com variáveis locais fictícias: Manager API, Worker, Web e
  Mobile gerados; permanece apenas o aviso não bloqueante já conhecido do bundle
  Web maior que 500 kB;
- inspeção dos artefatos: nenhum arquivo de teste foi emitido pela Manager API
  ou pelo Worker;
- smoke dos artefatos: a API devolveu os headers, registrou `/health` e
  `unmatched` sem expor path/query sensíveis, e o Worker registrou ready/stop;
  ambos encerraram por `SIGTERM` com código 0;
- `docker compose config --quiet`: configuração válida;
- build e smoke da imagem da Manager API em `PROD`: health e headers aprovados,
  logs JSON normalizados sem o ID/token da URL e encerramento com código 0;
  container e imagem temporários foram removidos.

### Decisões e pendências

- nenhum ADR adicional foi necessário: o ticket concretiza o plugin de logging,
  Pino e a correlação já previstos na arquitetura-alvo, sem trocar tecnologia
  ou fronteira de camada;
- Redis, filas e processors ainda não existem; os tickets futuros devem usar a
  fronteira de metadata e logger correlacionado criada neste incremento;
- identificadores de conta, usuário, organização, unidade e recurso permanecem
  bloqueados até aprovação explícita da política operacional;
- `PROT-009` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-25 — PROT-007 — Consolidar Swagger/OpenAPI

Status: Concluído

### Resultado

`packages/schema` agora é a fonte oficial dos contratos HTTP da Manager API.
Health, readiness e a resposta comum de erro geram componentes OpenAPI 3.1 com
referências locais estáveis; tags e o esquema HTTP Bearer também são
compartilhados pelo package.

O registro de rotas falha durante o bootstrap quando o contrato não declara
schema, metadados, tags, security e responses. A documentação HTTP do Swagger
fica disponível em `LOCAL`, `DEV` e `HMG` e responde 404 em `PROD`, enquanto a
geração em memória permanece ativa para validação interna.

### Arquivos e dados

- criados em `packages/schema/common` os componentes `OperationalStatus` e
  `ErrorResponse`, com tipos TypeScript derivados do TypeBox e exemplos
  fictícios, e em `packages/schema/openapi` o catálogo de tags e o security
  scheme `bearerAuth`;
- health e readiness passaram a declarar summary, description, operationId,
  exposição pública explícita e responses referenciadas; o tipo
  `ErrorResponse` saiu de `common` e passou a derivar do schema oficial, e o
  enum de tag duplicado foi removido;
- o plugin Swagger passou a registrar schemas compartilhados, gerar OpenAPI
  3.1 com nomes estáveis e rejeitar rotas sem contrato completo;
- a UI, o JSON e o YAML são registrados somente fora de produção; a UI ganhou
  Content Security Policy e o validador remoto permaneceu desabilitado;
- adicionados testes estruturais do documento e das referências, snapshot do
  contrato operacional, security de operação protegida, exemplos sem segredo,
  guarda de rotas e matriz de exposição;
- criado `docs/api/OPENAPI.md` e atualizados catálogo da API, README,
  arquitetura atual, qualidade, guia de rotas, roadmap e índices;
- nenhuma biblioteca foi adicionada ou atualizada; o lockfile apenas recebeu a
  nova dependência interna de `plugins` para `schema`; nenhuma migration, seed,
  tabela, permissão, rota de negócio ou dado foi criado ou alterado.

### Validação

- `pnpm install --frozen-lockfile --offline`: os 15 projetos permaneceram
  sincronizados sem download;
- `pnpm test`: 35 testes aprovados em quatro workspaces, incluindo sete da
  Manager API e todos os cenários OpenAPI do ticket;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`, com as variáveis públicas locais exigidas: Manager API, Worker,
  Web e Mobile gerados; permanece apenas o aviso não bloqueante já conhecido do
  bundle Web maior que 500 kB;
- inspeção do artefato: arquivos de teste não foram emitidos;
- smoke do artefato compilado: em `LOCAL`, health, Swagger UI e JSON retornaram
  200 com OpenAPI 3.1; em `PROD`, health retornou 200 e UI, JSON e YAML
  retornaram 404; os dois processos encerraram com código 0;
- `docker compose config --quiet`: configuração válida;
- build e smoke da imagem da Manager API em `PROD`: health/readiness retornaram
  200, UI/JSON/YAML do Swagger retornaram 404 e o container encerrou com código
  0; container e imagem temporários foram removidos.

### Decisões e pendências

- nenhum ADR adicional foi necessário: o ticket concretiza `packages/schema` e
  o Swagger já previstos na arquitetura-alvo, sem trocar tecnologia ou
  fronteira de camada;
- o documento continua sendo gerado em memória em produção, mas nenhum recurso
  HTTP do Swagger é registrado nesse ambiente;
- o esquema Bearer prepara os contratos futuros, mas não cria autenticação nem
  endpoint protegido; identidade e acesso permanecem em seus tickets;
- `PROT-008` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-25 — PROT-006 — Consolidar API base, health e readiness

Status: Concluído

### Resultado

A Manager API agora separa liveness em `GET /health` de readiness em
`GET /ready`. Um registry compartilhado executa todos os probes obrigatórios e
trata retorno falso ou exceção como indisponibilidade, respondendo 503 pelo
contrato global sem revelar diagnósticos internos.

O bootstrap testável formaliza `/api/v1` como prefixo exclusivo das futuras
rotas de negócio. `SIGINT` e `SIGTERM` iniciam uma única rotina de shutdown, que
interrompe readiness antes de fechar o listener e os recursos registrados no
Fastify.

### Arquivos e dados

- separado o bootstrap Fastify em `app.ts`, a entrada de processo em
  `server.ts` e o ciclo de vida testável em `lifecycle.ts`;
- criado em `packages/plugins/readiness` um registry extensível, com nomes
  únicos, suporte a probes síncronos/assíncronos e estado terminal de shutdown;
- criado `GET /ready`, com schema 200/503, mensagem traduzida nos três idiomas e
  código estável `SERVICE_NOT_READY`; `GET /health` preserva exatamente o
  contrato anterior;
- adicionada `ServiceUnavailableError` com status 503 às classes comuns;
- formalizada a constante de prefixo `/api/v1`; health, readiness e Swagger
  permanecem fora do agregador de negócio;
- o shutdown idempotente passou a marcar readiness como indisponível, parar o
  listener e executar `onClose`, incluindo `pool.end()`;
- incluídos testes do registry, integração dos endpoints, degradação/recuperação
  de probe, sanitização e `SIGTERM`; a Manager API ganhou configuração de build
  que não emite os testes;
- atualizados catálogo da API, i18n, README, arquitetura atual, qualidade, guia
  de rotas, roadmap e índices;
- nenhuma dependência foi adicionada ou atualizada; nenhuma migration, seed,
  tabela, permissão, rota de negócio ou dado foi criado ou alterado.

### Validação

- `pnpm test`: 31 testes aprovados em quatro workspaces, incluindo liveness,
  readiness pronta/indisponível/recuperada, exceção de probe e shutdown;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`, com as variáveis públicas locais exigidas: Manager API, Worker,
  Web e Mobile gerados; permanece apenas o aviso não bloqueante já conhecido do
  bundle Web maior que 500 kB;
- inspeção do artefato: arquivos de teste não foram emitidos;
- smoke do artefato compilado: `/health` e `/ready` retornaram 200; `SIGTERM`
  encerrou o processo com código 0 e a porta deixou de aceitar conexões;
- `docker compose config --quiet`: configuração válida;
- build e smoke da imagem da Manager API: health e readiness retornaram 200 e
  `docker stop` encerrou o container com código 0; container e imagem temporários
  foram removidos.

### Decisões e pendências

- nenhum ADR adicional foi necessário: o ticket concretiza o ciclo de vida e a
  extensão de infraestrutura previstos, sem trocar tecnologia ou fronteira;
- todos os probes registrados são obrigatórios; neste incremento a lista é
  vazia. Redis e PostgreSQL registrarão probes em `PROT-009` e `PROT-011`;
- timeout é responsabilidade do cliente de cada integração, para que o registry
  não imponha uma política incompatível com dependências diferentes;
- `PROT-007` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-25 — PROT-005 — Consolidar internacionalização do backend

Status: Concluído

### Resultado

A Manager API agora negocia `pt-BR`, `en` e `es` por `Accept-Language`,
respeitando pesos `q` e variantes regionais. Locale ausente, desconhecido,
malformado ou não aceito usa `pt-BR`; toda resposta informa o locale efetivo em
`Content-Language` e varia por `Accept-Language`.

Os catálogos possuem chaves comuns equivalentes de erros, saúde e autenticação.
O handler global traduz a mensagem pública desde o início da requisição,
inclusive em falhas de schema e rotas inexistentes, sem alterar `code`, status
HTTP ou `requestId` e sem expor detalhes internos.

### Arquivos e dados

- consolidado em `packages/plugins/i18next` um resolvedor puro de locale, uma
  instância isolada do i18next por servidor e a integração Fastify em
  `onRequest`/`onSend`;
- preenchidos os catálogos `pt-BR`, `en` e `es`; o diretório legado `pt` foi
  substituído pelo locale canônico `pt-BR`;
- as classes comuns de erro passaram a aceitar `messageKey`; defaults usam
  chaves comuns e mensagens específicas sem chave preservam o fallback seguro;
- o handler de erros passou a traduzir somente `message`, mantendo estáveis os
  demais campos do contrato;
- adicionados testes de resolução/fallback, pesos, variantes, paridade e textos
  vazios dos catálogos, headers HTTP e erros nos três idiomas;
- o build da Manager API passou a copiar os catálogos para o artefato compilado;
  dependências redundantes foram removidas e o lockfile foi sincronizado;
- documentados idiomas, headers, fallback e convenção de chaves em `docs/api`,
  README, arquitetura atual, guia de rotas, qualidade e roadmap;
- nenhuma migration, seed, tabela, rota de negócio, permissão ou dado foi criado
  ou alterado.

### Validação

- `pnpm test`: 24 testes aprovados, incluindo resolução/fallback, paridade dos
  três catálogos e integração HTTP por idioma;
- `pnpm lint`: 14 tarefas de workspace concluídas sem warnings;
- `pnpm typecheck`: 14 tarefas de workspace concluídas;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`, com as variáveis públicas locais exigidas: Manager API, Worker,
  Web e Mobile gerados; permanece apenas o aviso não bloqueante já conhecido do
  bundle Web maior que 500 kB;
- inspeção do artefato compilado: os três JSONs de locale foram empacotados;
- smoke do artefato compilado: `/health` retornou 200 com locale negociado e
  rota inexistente retornou `NOT_FOUND` traduzido em `pt-BR`, `en`, `es` e com
  fallback, preservando contrato e headers;
- build e smoke da imagem da Manager API: health em `es` e erro em `en` foram
  aprovados; o container e a imagem temporários foram removidos.

### Decisões e pendências

- nenhum ADR adicional foi necessário: o ticket concretiza a internacionalização
  prevista em `packages/plugins` sem mudar tecnologia ou fronteira de camada;
- as chaves comuns de autenticação não criam fluxo ou endpoint; autenticação
  permanece nos tickets de identidade e acesso;
- `PROT-006` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-24 — PROT-004 — Implantar o padrão global de erros

Status: Concluído

### Resultado

A Manager API agora possui classes de erro comuns e um handler Fastify global.
Erros previstos recebem status e códigos estáveis; erros desconhecidos viram
`INTERNAL_SERVER_ERROR` com status 500. Toda resposta de falha contém somente
`code`, `message` e `requestId`, sem stack, causa, detalhes de schema ou valores
recebidos.

O handler também padroniza rotas inexistentes e erros HTTP de cliente gerados
pelo framework. Falhas 4xx registram somente metadados; falhas 5xx mantêm o erro
ou a causa original no log interno associado ao `requestId`, sem reutilizá-lo na
resposta.

### Arquivos e dados

- criadas em `packages/common/errors` `ApplicationError`, `ValidationError`,
  `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`,
  `BusinessRuleError`, `InfrastructureError` e o tipo `ErrorResponse`;
- criado em `packages/plugins/error-handler` o mapeamento global de erros de
  aplicação, validação, framework, infraestrutura, rota inexistente e falha
  desconhecida;
- a Manager API passou a registrar o handler antes dos demais plugins e rotas;
- adicionados scripts e dependências de teste aos workspaces `common` e
  `plugins`, com lockfile sincronizado;
- documentados contrato, códigos, status, regras de lançamento e limites atuais
  em `docs/api`, README, arquitetura atual, qualidade e roadmap;
- nenhuma migration, seed, tabela, rota de negócio, permissão ou dado foi criado
  ou alterado.

### Validação

- `pnpm install --frozen-lockfile --offline`: os 15 projetos e o lockfile
  permaneceram sincronizados sem baixar dependências;
- `pnpm test`: 19 testes aprovados, sendo 11 de configuração, quatro das
  classes e quatro de integração do handler;
- cenários do handler: 400, 401, 403, 404, 409, 422, 500 previsto, 500
  desconhecido, rota inexistente e validação com valor sensível aprovados;
- captura de log: diagnósticos originais de falhas 500 permaneceram no log com
  `requestId` e não apareceram na resposta;
- `pnpm lint`: 14 tarefas de workspace concluídas sem warnings;
- `pnpm typecheck`: 14 tarefas de workspace concluídas;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece apenas o
  aviso não bloqueante já conhecido do bundle Web maior que 500 kB;
- smoke do artefato compilado: `/health` retornou 200 e rota inexistente
  retornou 404 com `NOT_FOUND`, mensagem segura e `requestId`;
- build e smoke da imagem da Manager API: os mesmos cenários 200 e 404 foram
  aprovados, e o container e a imagem temporária foram removidos;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados.

### Decisões e pendências

- nenhum ADR adicional foi necessário: o ticket concretiza as fronteiras de
  erros em `common` e plugins Fastify já previstas na arquitetura-alvo;
- os defaults de mensagem permanecem em `pt-BR`; negociação de idioma, fallback
  e paridade dos catálogos pertencem ao `PROT-005`;
- schema OpenAPI comum de erro pertence ao `PROT-007`; aceitação de request ID
  externo, correlação e redaction ampla pertencem ao `PROT-008`;
- `PROT-005` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-24 — PROT-003 — Centralizar e validar configurações

Status: Concluído

### Resultado

`packages/config` tornou-se a única fronteira que lê variáveis de ambiente. Os
valores são validados por app e por capacidade, normalizados e expostos em
objetos tipados e congelados. Erros de ausência, formato ou configuração
insegura citam somente as chaves envolvidas, sem ecoar valores.

Manager API, Worker, Vite/Web e Expo/Mobile validam seus conjuntos mínimos antes
de iniciar. Defaults operacionais existem somente fora de `PROD`; produção
exige valores explícitos e rejeita marcadores conhecidos de exemplo em segredos
e na credencial da URL do banco.

### Arquivos e dados

- criados os validadores puros, tipos, erro sanitizado, leitura central de
  runtime e 11 testes unitários em `packages/config`;
- criados contratos separados para Manager API, Worker, Web, Mobile, banco,
  Redis, JWT, criptografia, S3 e SMTP;
- Manager API passou a receber banco e origens CORS a partir do objeto validado,
  e o host e o nível de log deixaram de ser hardcoded;
- Worker passou a validar ambiente e log antes de entrar em espera; seu build
  passou a incorporar e reescrever corretamente o package compartilhado;
- Vite e Expo passaram a validar e incorporar somente as configurações públicas
  dos clientes durante o bootstrap;
- `.env.example`, Compose, scripts de teste, cache do Turbo, manifests e
  lockfile foram sincronizados; os valores de exemplo não são segredos reais;
- criada `docs/CONFIGURATION.md` com matriz por app, defaults, capacidades,
  regras de produção e variáveis exclusivas de infraestrutura;
- atualizados README, arquitetura atual, qualidade, roadmap e índices; nenhuma
  migration, seed, tabela, rota, permissão ou dado foi criado ou alterado.

### Validação

- `pnpm install --frozen-lockfile`: lockfile e 15 projetos sincronizados;
- `pnpm test`: 11 testes de configuração aprovados, incluindo ausência, tipos
  inválidos, segredo vazio, placeholders de produção, sanitização e
  imutabilidade;
- `pnpm lint`: 14 tarefas de workspace concluídas sem warnings;
- `pnpm typecheck`: 14 tarefas de workspace concluídas;
- `pnpm format:check` e `pnpm -r --if-present format:check`: repositório e 14
  workspaces formatados;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece apenas o
  aviso não bloqueante já conhecido do bundle Web maior que 500 kB;
- smokes compilados: `/health` retornou `200`, Worker encerrou por `SIGINT` com
  código `0`, Web serviu o shell e Metro retornou `packager-status:running`;
- smokes negativos dos quatro apps: chaves ausentes interromperam o bootstrap
  com erro sanitizado e código diferente de zero;
- busca em `apps` e `packages`: único acesso a `process.env` localizado em
  `packages/config/runtime.ts`;
- `docker compose config --quiet`: configuração válida;
- build e smoke da imagem da Manager API: `/health` retornou `200` e o container
  encerrou com código `0`.

### Decisões e pendências

- nenhum ADR adicional foi necessário: o ticket concretiza a fronteira de
  configuração já aprovada sem trocar tecnologia ou responsabilidade;
- Redis, emissão JWT, criptografia de dados, S3 e SMTP possuem somente contratos
  de configuração; suas integrações continuam nos tickets próprios;
- os achados da auditoria de dependências de `PROT-002` não foram alterados;
- `PROT-004` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-23 — PROT-002 — Configurar TypeScript, lint e formatter

Status: Concluído

### Resultado

Os quatro apps e os dez packages agora compartilham regras TypeScript estritas,
lint tipado e formatação reproduzível. Cada workspace pode executar seus
comandos de qualidade isoladamente, enquanto a raiz os coordena pelo Turbo.

`any` explícito é bloqueado pelo ESLint. Exceções exigem uma desabilitação
restrita à linha e uma justificativa textual, com diretivas desnecessárias
tratadas como erro.

### Arquivos e dados

- criado `tsconfig.base.json` com `strict`, `noImplicitAny`,
  `strictNullChecks`, `useUnknownInCatchVariables` e proteções comuns;
- os apps passaram a estender a base conforme Node.js, Vite/Vue ou Expo, e cada
  package recebeu `tsconfig.json` próprio;
- criado `eslint.config.mjs` com flat config, regras TypeScript com informação
  de tipos, Vue, React Hooks, Prettier e validação de justificativas;
- adicionados scripts `lint`, `typecheck`, `format` e `format:check` aos
  workspaces, a tarefa `lint` e as configurações globais do cache ao Turbo;
- criados `.prettierignore` e ignores equivalentes para dependências, builds,
  caches e cobertura; o lockfile voltou a ser mantido no formato do pnpm;
- corrigidos o contrato síncrono do plugin de banco, os callbacks de sinais da
  API e a declaração de componentes Vue encontrados pelo lint tipado;
- documentadas as convenções em `docs/QUALITY.md`, README, arquitetura atual e
  roadmap;
- nenhuma migration, seed, tabela, rota de negócio, permissão ou dado foi
  criado ou alterado.

### Validação

- `pnpm install --frozen-lockfile`: dependências e os 15 projetos sincronizados;
- `pnpm lint`: 14 tarefas de workspace concluídas sem warnings;
- `pnpm typecheck`: 14 tarefas de workspace concluídas;
- `pnpm format:check`: repositório formatado;
- `pnpm -r --if-present format:check`: quatro apps e dez packages formatados;
- casos negativos em memória: `TS7006` rejeitou `any` implícito, `TS2322`
  rejeitou `null` em `string` e o ESLint rejeitou `any` explícito;
- supressão sem justificativa: rejeitada; exceção local justificada: aceita;
  buscas por `any` e diretivas no código versionado: sem ocorrências;
- `pnpm build`: os quatro apps foram gerados com sucesso.

### Decisões e pendências

- nenhum ADR adicional foi necessário: o ticket materializa o padrão de
  qualidade já aprovado, sem alterar fronteiras ou tecnologias de runtime;
- a auditoria adicional encontrou 10 vulnerabilidades altas no grafo atual;
  elas não foram corrigidas porque exigem atualizar bibliotecas existentes fora
  do escopo, e o snapshot está em
  `docs/implementation/DEPENDENCY_AUDIT_2026-08-23.md`;
- `PROT-003` é o próximo ticket liberado para execução;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-23 — PROT-001 — Consolidar a estrutura do monorepo

Status: Concluído

### Resultado

O pnpm e o Turbo reconhecem Manager API, Worker, Web e Mobile como apps
independentes. O novo Worker permanece ocioso sem busy loop e encerra por
`SIGINT` ou `SIGTERM`, sem antecipar Redis, filas, processors ou jobs.

Os dez diretórios compartilhados de `packages/` foram registrados como
workspaces de código-fonte com manifests e entrypoints públicos. O alias genérico
`@core/*` foi substituído pelos nomes explícitos `@protege-mais/*`, e nenhuma
dependência aponta de package para app.

### Arquivos e dados

- criado `apps/worker` com entrypoint, configuração TypeScript e scripts `dev`,
  `build`, `typecheck` e `start`;
- normalizado o workspace HTTP para `@protege-mais/manager-api` e atualizado seu
  Dockerfile;
- adicionados manifests e entrypoints a `common`, `config`, `interfaces`,
  `middlewares`, `models`, `plugins`, `repositories`, `schema`, `services` e
  `useCases`;
- dependências externas foram movidas da raiz para os workspaces consumidores;
  o Manager API também declara `uuid`, pois incorpora o package `common` em seu
  artefato compilado;
- atualizados `pnpm-workspace.yaml`, aliases TypeScript, scripts raiz e lockfile;
- nenhuma migration, seed, tabela, rota de negócio, permissão ou dado foi criado.

### Validação

- `pnpm install --frozen-lockfile`: reconheceu raiz, quatro apps e dez packages;
- `pnpm -r list --depth -1`: listou os 15 projetos esperados;
- `pnpm typecheck`: quatro tarefas de app concluídas, incluindo todos os sources
  compartilhados consumidos pelo Manager API;
- `pnpm build`: quatro builds concluídos a partir da raiz;
- grafo `dev` do Turbo: quatro tarefas persistentes reconhecidas;
- smoke isolado da API: `/health` e `/swagger/` retornaram `200`;
- smoke isolado do Web: raiz retornou `200`;
- smoke isolado do Mobile: Metro retornou `packager-status:running` e `200`;
- smoke isolado do Worker: permaneceu aguardando e encerrou por `SIGTERM` com
  código `0`;
- build e smoke da imagem do Manager API: `/health` retornou `200` e o container
  encerrou com código `0`;
- busca por `@core/*` no código e por dependências de apps em packages sem
  ocorrências;
- configuração do Docker Compose validada.

### Decisões e pendências

- nenhum ADR adicional foi necessário: a mudança materializa as fronteiras já
  aprovadas na arquitetura-alvo, sem trocar tecnologia ou responsabilidade;
- configuração TypeScript comum completa, lint e formatter por workspace
  permanecem em `PROT-002`;
- configuração validada por app permanece em `PROT-003`, Redis em `PROT-009` e
  filas/processors do Worker em `PROT-010`;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-23 — PROT-000 — Sanear o legado e congelar o baseline

Status: Concluído

### Resultado

O template anterior foi reduzido a shells mínimos de API, Web e Mobile. Foram
removidos os domínios de jogo, usuário e autorização herdados, sem introduzir
entidades ou regras de negócio do Protege Mais antes dos respectivos tickets.

### Arquivos e dados

- 78 arquivos rastreados do legado foram removidos, incluindo models, rotas,
  controllers, schemas, repositories, services, use cases, telas e permissões;
- as migrations e seeds Atlas foram esvaziadas e mantidas por `.gitkeep`, sem
  aplicar SQL nem excluir volumes externos de PostgreSQL;
- o schema Drizzle ficou explicitamente vazio até `PROT-011`;
- as dependências exclusivas de JWT e AWS SDK e suas configurações foram
  removidas;
- o build da API passou a limpar `dist` antes de compilar, impedindo que o cache
  restaure arquivos executáveis removidos do legado;
- a API preserva apenas `GET /health`, Swagger e o agregador vazio `/api/v1`;
- Web e Mobile foram reduzidos a shells institucionais sem fluxo funcional;
- a matriz de manter, adaptar e remover foi registrada em
  `docs/implementation/PROT-000_LEGACY_INVENTORY.md`.

### Validação

- busca textual no código-fonte e nos artefatos recompilados sem referências aos
  domínios antigos;
- `pnpm typecheck`, `pnpm build` e `pnpm format:check` executados com sucesso nos
  workspaces;
- API inicializada: `/health` e `/swagger/` retornaram `200`; as antigas rotas
  `/api/v1/users` e `/api/v1/auth/login` retornaram `404`;
- Web inicializada e shell principal servido com `200`;
- diretórios Atlas de produção e desenvolvimento validados sem migrations, e
  export Drizzle confirmado sem DDL;
- configuração do Docker Compose validada sem dependência da API no MinIO.

### Decisões e pendências

- capacidades genéricas preservadas estão documentadas no inventário do ticket;
- nenhum ADR adicional foi necessário, pois o saneamento seguiu a arquitetura e
  o escopo já aprovados;
- `PROT-001` é o próximo ticket liberado para execução;
- o aviso de tamanho do bundle Web permanece não bloqueante e deve ser tratado em
  ticket de otimização, sem ampliar o escopo deste baseline.

## 2026-08-23 — DOC-001 — Backlog e arquitetura documental

Status: Concluído

### Resultado

Criados o índice documental, a arquitetura-alvo, os requisitos de segurança e
privacidade, o roadmap incremental, os tickets `PROT-000` a `PROT-050` e o
processo obrigatório de atualização da documentação.

### Arquivos e dados

- documentação adicionada em `docs/architecture`, `docs/product`,
  `docs/tickets`, `docs/implementation` e `docs/decisions`;
- nenhuma feature, migration ou dado de negócio foi criado;
- o estado legado foi explicitamente separado da arquitetura-alvo.

### Validação

- links relativos verificados;
- IDs, dependências e cobertura de `PROT-000` a `PROT-050` conferidos;
- arquivos Markdown validados com o formatter do projeto.

### Decisões e pendências

- os módulos posteriores a `PROT-050` permanecem em grooming;
- nenhum ADR de implementação foi necessário.
