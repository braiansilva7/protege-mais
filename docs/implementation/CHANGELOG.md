# Registro de implementação

Este arquivo registra somente mudanças efetivamente realizadas. Planos futuros
ficam no roadmap e nos tickets.

## 2026-08-30 — PROT-021 — Criar organization_members

Status: Concluído

### Resultado

O schema passa a vincular uma conta a uma organização e, opcionalmente, a
uma unidade dessa mesma organização. A mesma conta pode participar de múltiplas
organizações e manter, em uma organização, tanto o vínculo geral quanto
vínculos específicos por unidade.

Cada contexto exato é único mesmo quando a unidade é nula. Matrícula e cargo
são metadados opcionais normalizados; o estado ativo é consultável por índice
parcial, mas não concede permissão isoladamente. Papéis continuam exclusivamente
em `account_roles`.

### Arquivos e dados

- criado `packages/common/organization-members` com quatro testes e
  normalizações idempotentes de matrícula e cargo, preservando caixa e acentos e
  rejeitando valores vazios, não canônicos, extensos ou com caracteres de
  controle;
- criado `packages/models/organization-members.ts` com dez colunas, UUID v7 da
  aplicação, três FKs restritivas, três checks, unicidade contextual com
  `NULLS NOT DISTINCT`, dois índices e optimistic locking; a projeção segura
  omite matrícula;
- a FK composta `(organization_id, organization_unit_id)` garante que a unidade
  informada pertença à organização; as FKs simples preservam conta e organização
  referenciadas;
- criada a migration estrutural
  `atlas/prod/20260830144651_create_organization_members.sql`, sem seed, dado de
  domínio, UUID gerado pelo banco, papel ou operação destrutiva;
- adicionados cinco testes do model e três integrações PostgreSQL de membership;
  o logger passou a proteger IDs do vínculo, matrícula e cargo;
- criado `docs/database/ORGANIZATION_MEMBERS.md` e aceito o `ADR-008`; README,
  arquitetura atual, segurança, observabilidade, banco, permissões, qualidade,
  roadmap, índice documental e tickets foram sincronizados;
- nenhum endpoint, repository, caso de uso, seed, papel, atribuição ou regra de
  autorização funcional foi criado.

### Validação

- produção isolada em base descartável criada de `template0`: oito migrations
  e 43 instruções aplicadas até `20260830144651`; a segunda aplicação não
  encontrou arquivo pendente e a base foi removida ao final;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, oito arquivos executados, zero pendências e zero drift estrutural;
- FKs inexistentes, unidade de outra organização, contexto duplicado e campos
  inválidos foram rejeitados em PostgreSQL real; múltiplas organizações,
  vínculo geral e por unidade coexistiram sem criar papel;
- inativação, consulta somente de ativos, reativação, contexto reservado,
  optimistic locking, remoções restritivas e uso do índice parcial foram
  comprovados;
- `pnpm --filter @protege-mais/plugins test:database`: 23 testes reais
  aprovados, incluindo contas, sessões, organizações, unidades, memberships,
  RBAC, seed, enums, Drizzle/UTC, PostGIS e retomada;
- `pnpm test`: 126 testes aprovados em sete workspaces;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm model:export` produziu tabela, FKs e índices esperados;
  `model:reference:validate` e `model:reference:diff` confirmaram o fixture de
  convenções sem drift;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado em
  Redis temporário isolado;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB;
- `pnpm format:check`, `pnpm -r --if-present format:check`, `git diff --check` e
  `docker compose config --quiet`: formatação, whitespace e Compose válidos.

### Decisões e pendências

- o contexto durável é `(account_id, organization_id, organization_unit_id)`;
  a inativação preserva e reserva a linha, sem soft delete ou recriação;
- matrícula e cargo são opcionais para acomodar voluntários, colaboradores e
  contas de serviço; matrícula não recebeu unicidade sem regra de escopo
  aprovada;
- FKs garantem existência e coerência, não atividade ou autorização; o vínculo
  ativo será apenas uma entrada da decisão funcional dos tickets `PROT-030` a
  `PROT-032`;
- papel e membership permanecem conceitos independentes; nenhum papel é
  inferido, duplicado ou concedido pelo vínculo;
- a estratégia de produção é forward-only; eventual correção usa nova migration
  e nunca remove automaticamente vínculo ou histórico;
- `PROT-022` é o próximo ticket liberado e iniciará o fluxo funcional de
  autenticação;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-30 — PROT-020 — Criar organization_units

Status: Concluído

### Resultado

O schema passa a representar unidades operacionais pertencentes a uma única
organização, com identidade contextual, contatos opcionais, endereço brasileiro
estruturado, ativação explícita, optimistic locking e soft delete. Longitude e
latitude validadas geram sempre uma posição `geography(Point,4326)`; consultas
`ST_DWithin` usam GiST e distâncias geodésicas permanecem em metros.

O código é único dentro da organização e continua reservado após soft delete.
Uma unidade só é operacional quando ela e sua organização estão ativas e não
excluídas. `account_roles` agora usa FK composta para impedir unidade inexistente
ou pertencente a outra organização, sem ativar autorização funcional.

### Arquivos e dados

- criado `packages/common/organization-units` com cinco testes e normalizações
  idempotentes para nome, código, tipo, contatos, endereço, CEP, UF, município e
  limites geográficos, incluindo rejeição de `NaN` e infinito;
- criado `packages/models/organization-units.ts` com 23 colunas, UUID v7 da
  aplicação, 13 checks, duas unicidades, FK restritiva, índice parcial de nome e
  GiST de posição; a projeção segura omite contato, endereço, coordenadas,
  posição e soft delete;
- `position` é armazenada e gerada dos escalares; o mapper Drizzle valida EWKB,
  Point e SRID 4326 ao converter a leitura do PostGIS;
- `account_roles` recebeu a FK composta nomeada para
  `(organization_id, organization_unit_id)` e índice inverso por unidade; as
  integrações rejeitam par contextual divergente e hard delete referenciado;
- criada a migration estrutural
  `atlas/prod/20260830142030_create_organization_units.sql`, sem seed, dado de
  domínio, UUID gerado pelo banco ou operação destrutiva;
- criado `scripts/export-atlas-schema.mjs` para adaptar o typmod PostGIS na
  fronteira Drizzle→Atlas e preparar somente o banco descartável `DB_ATLAS`; a
  raiz passou a declarar o `pg` 8.22.0 já resolvido nos workspaces, sem upgrade
  de versão;
- adicionados seis testes do model e três integrações PostgreSQL de unidades;
  as suítes de RBAC e logging foram ampliadas para coerência contextual e
  redaction de `position`;
- criado `docs/database/ORGANIZATION_UNITS.md` e aceito o `ADR-007`; README,
  arquitetura atual, segurança, observabilidade, banco, enums, permissões,
  qualidade, roadmap, índice documental e tickets foram sincronizados;
- nenhum endpoint, repository, seed, papel, atribuição, membership, integração
  externa ou dado pessoal real foi criado.

### Validação

- produção isolada em base descartável: sete migrations e 40 instruções
  aplicadas até `20260830142030`; a segunda aplicação não encontrou arquivo
  pendente e a base foi removida ao final;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, sete arquivos executados, zero pendências e zero drift estrutural;
- relação 1:N, código igual em organizações diferentes, reserva após soft
  delete, FK do pai, FK contextual composta e remoções restritivas foram
  comprovadas em PostgreSQL real;
- normalização, tipo, contatos, endereço, CEP, UF/município, longitude/latitude,
  `NaN`, infinito e escrita direta da coluna gerada inválidos foram rejeitados;
- Point/SRID/longitude/latitude persistidos foram conferidos; `ST_DWithin`
  separou unidades próximas e distantes e `EXPLAIN` usou
  `organization_units_position_gix`;
- `pnpm --filter @protege-mais/plugins test:database`: 20 testes reais
  aprovados, incluindo contas, sessões, organizações, unidades, RBAC, seed,
  enums, Drizzle/UTC, PostGIS e retomada;
- `pnpm test`: 117 testes aprovados em sete workspaces;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm model:export` produziu `geography(Point,4326)` válido;
  `model:reference:validate` e `model:reference:diff` confirmaram o fixture de
  convenções sem drift;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado em
  Redis temporário isolado;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB;
- `pnpm format:check`, `pnpm -r --if-present format:check`, `git diff --check` e
  `docker compose config --quiet`: formatação, whitespace e Compose válidos.

### Decisões e pendências

- escalares validados são a única entrada espacial; `position` gerada impede
  divergência e evita a coerção silenciosa de coordenadas fora da faixa pelo
  PostGIS;
- tipo de unidade permanece código técnico `snake_case`, sem enum ou labels de
  negócio inventados; um catálogo futuro exige definição própria;
- endereço é estruturado e obrigatório, exceto complemento; contato é opcional
  e endereço, contato e localização permanecem fora da projeção e dos logs;
- código e ownership são identidades contextuais duráveis; mudança de
  organização ou reutilização após soft delete exige caso de uso e nova
  decisão;
- FKs garantem existência e coerência, não atividade, membership ou permissão;
  essas decisões continuam nos tickets `PROT-021`, `PROT-030` a `PROT-032`;
- a estratégia de produção é forward-only; eventual correção usa nova migration
  e nunca remove automaticamente PostGIS, unidade ou histórico;
- `PROT-021` é o próximo ticket liberado e criará `organization_members`;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-30 — PROT-019 — Criar tabela organizations

Status: Concluído

### Resultado

O schema passa a representar organizações com identidade institucional,
localidade IBGE, ativação explícita, configuração de integração, optimistic
locking e soft delete. Nome e razão social possuem chaves normalizadas para
pesquisa; CNPJs numéricos e alfanuméricos são armazenados sem máscara e têm
formato e dígitos verificadores validados no TypeScript e no PostgreSQL.

O CNPJ é único globalmente e continua reservado após soft delete. Uma
organização só é operacional quando `is_active AND deleted_at IS NULL`; a flag
de integração não sobrepõe esse predicado. `account_roles.organization_id`
agora possui FK restritiva, sem ativar autorização funcional.

### Arquivos e dados

- criado `packages/common/organizations` com normalização idempotente de nomes,
  CNPJ, UF e município, os 27 códigos estaduais e validação do CNPJ por módulo
  11 com `ASCII - 48`; o exemplo fictício oficial de cálculo da Receita Federal
  integra os fixtures;
- criado `packages/models/organizations.ts` com 15 colunas, UUID v7 gerado pela
  aplicação, oito checks nomeados, unicidade global de CNPJ e três índices
  parciais para buscas ativas por nome, razão social e município;
- a projeção pública omite CNPJ, razão social, chaves normalizadas e marca de
  exclusão; o logger também redige chaves e padrões de CNPJ numérico ou
  alfanumérico em qualquer ambiente;
- `account_roles` recebeu a FK nomeada para `organizations`, com `ON UPDATE NO
ACTION` e `ON DELETE RESTRICT`; o identificador de unidade continua reservado
  para o `PROT-020`;
- criada a migration estrutural
  `atlas/prod/20260830134040_create_organizations.sql` e atualizado o checksum
  de produção, sem seed, dado de domínio, UUID gerado pelo banco ou operação
  destrutiva;
- adicionados quatro testes de normalização, cinco testes do model e três
  testes PostgreSQL de organizações; as integrações existentes de RBAC agora
  comprovam a FK, a rejeição de contexto inexistente e a remoção referenciada;
- criado `docs/database/ORGANIZATIONS.md` e aceito o `ADR-006`; README,
  arquitetura atual, segurança, observabilidade, banco, enums, permissões,
  qualidade, roadmap, índice documental e tickets foram sincronizados;
- nenhuma versão de dependência ou lockfile foi alterada; nenhum endpoint,
  repository, seed, papel, atribuição, membership ou integração externa foi
  criado.

### Validação

- produção isolada em base descartável: seis migrations e 35 instruções
  aplicadas, sete tabelas de domínio e zero dados antes das integrações; uma
  segunda aplicação não encontrou arquivo pendente e a base foi removida ao
  final;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, versão `20260830134040`, seis arquivos executados, zero pendências e
  zero drift estrutural;
- CNPJ numérico/alfanumérico válido persistiu; formato, dígitos, sentinela
  todo-zero, tipo, status, UF, município e normalização inválidos foram
  rejeitados pelo banco;
- soft delete manteve a reserva global do CNPJ, update com versão obsoleta
  afetou zero linhas e planos reais usaram os índices parciais de nome e
  município;
- a FK organizacional rejeitou UUID inexistente e hard delete referenciado; a
  consulta RBAC continuou combinando contextos globais e organizacionais;
- `pnpm --filter @protege-mais/plugins test:database`: 17 testes reais
  aprovados, incluindo contas, sessões, organizações, RBAC, seed, enums,
  Drizzle/UTC, PostGIS e retomada;
- `pnpm test`: 106 testes aprovados em sete workspaces;
- `pnpm lint` e `pnpm typecheck`: 14 tarefas de workspace concluídas sem
  warnings ou erros;
- `pnpm model:reference:validate` e `pnpm model:reference:diff`: fixture de
  convenções válido e sem drift;
- `pnpm --filter @protege-mais/plugins test:redis`: dois testes reais aprovados;
  `pnpm --filter @protege-mais/worker test:redis`: pipeline real aprovado em
  Redis temporário isolado;
- `pnpm format:check`, `pnpm -r --if-present format:check`, `git diff --check` e
  `docker compose config --quiet`: formatação, whitespace e Compose válidos;
- `pnpm build`: Manager API, Worker, Web e Mobile gerados; permanece o aviso
  não bloqueante já conhecido do bundle Web maior que 500 kB.

### Decisões e pendências

- os formatos numérico anterior e alfanumérico atual coexistem; a validação
  segue a documentação técnica da Receita Federal e não consulta situação
  cadastral externa;
- CNPJ não recebe a classificação de dado pessoal da vítima, mas permanece fora
  da projeção pública e da allowlist de logs para evitar exposição indevida;
- a identidade não é reutilizável: retorno da mesma instituição restaura a
  linha original com controle de versão;
- FK garante existência, não atividade, membership ou permissão; essas decisões
  continuam nos tickets `PROT-021`, `PROT-030` e `PROT-031`;
- a estratégia de produção é forward-only: eventual correção usa nova migration
  aditiva; não há rollback destrutivo automático de organização ou referência;
- `PROT-020` é o próximo ticket liberado e criará `organization_units` e sua FK
  contextual;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-018 — Criar seed inicial de permissões

Status: Concluído

### Resultado

O catálogo inicial passa a expor 19 permissões tipadas para `account`,
`organization`, `victim` e `case`. Cada recurso recebe `list`, `view`, `create`
e `update`; `account` também recebe `disable`, enquanto `case` recebe `close` e
`transfer`.

Um seed Atlas exclusivo de desenvolvimento insere esses mesmos códigos de forma
aditiva e idempotente. Reaplicá-lo não duplica registros nem altera permissões,
papéis, concessões ou atribuições locais. A estrutura de produção permanece
independente e vazia.

### Arquivos e dados

- criado `packages/common/permissions/index.ts` com `permissionCatalog`, a tuple
  plana `permissionCodes`, tipos literais de recurso/código e o type guard
  `isPermissionCode`; a entrada pública de `common` concentra os exports;
- criado `packages/common/permissions/permissions.test.ts` com quatro testes de
  conjunto exato, imutabilidade, formato, unicidade, type guard, paridade com o
  SQL/checksum e ausência do catálogo nas migrations de produção;
- criado o seed
  `atlas/seed/dev/20260827012543_initial_permission_catalog.sql`, com 19 UUIDs v7
  fictícios e explícitos e uma única instrução
  `INSERT ... ON CONFLICT (code) DO NOTHING`; o checksum `dev` foi atualizado e
  o `.gitkeep` deixou de ser necessário;
- adicionada integração PostgreSQL real que executa o SQL duas vezes, compara
  códigos e IDs e comprova a preservação de uma permissão local, sua concessão a
  papel e uma atribuição contextual;
- `docs/permissions/README.md` agora contém o catálogo, a semântica inicial, o
  fluxo local e o processo aditivo de expansão; README, segurança, qualidade,
  banco, arquitetura, roadmap e tickets foram sincronizados;
- nenhuma versão de dependência ou lockfile foi alterada; nenhum papel,
  atribuição, dado pessoal, rota, repository ou middleware foi criado.

### Validação

- produção isolada em base criada de `template0`: cinco migrations e 30
  instruções aplicadas, seis tabelas e zero permissões/papéis/atribuições sem
  executar seed;
- seed aplicado depois da estrutura na mesma base: uma migration e uma instrução
  criaram exatamente 19 permissões, com 19 IDs UUID v7 distintos e zero papéis
  ou atribuições; a segunda aplicação não encontrou arquivos pendentes e a base
  temporária foi removida;
- `pnpm seed:local` executado duas vezes: a primeira aplicação inseriu o catálogo
  e a segunda não executou migration; o banco local conserva as 19 permissões de
  desenvolvimento;
- `atlas migrate hash` no ambiente `dev` e `atlas migrate validate`, `status` e
  `diff` no ambiente `prod`: checksums válidos, seis revisões combinadas, zero
  pendências e zero drift estrutural;
- `pnpm model:reference:validate` e `pnpm model:reference:diff`: fixture de
  convenções válido e sem drift;
- `pnpm --filter @protege-mais/plugins test:database`: 14 testes reais
  aprovados, incluindo seed idempotente/paritário, preservação local e os
  baselines de contas, sessões, RBAC, enums, Drizzle/UTC, PostGIS e retomada;
- `pnpm test`: 97 testes aprovados em sete workspaces;
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

- `code` é o identificador funcional estável; o UUID fixo identifica a linha
  fictícia, mas uma linha preexistente com o mesmo código é preservada;
- nenhum papel foi semeado porque o ticket não define um papel inicial; matrizes
  e atribuições não são inferidas do conjunto de permissões;
- expansão cria uma nova migration aditiva e atualiza o catálogo no mesmo
  ticket; seeds compartilhados não são reescritos e nunca removem concessões;
- nenhum ADR novo: a implementação materializa a separação `prod`/`seed/dev` e
  o catálogo global já aprovados pela arquitetura e pelo `ADR-005`;
- o `PROT-019` é o próximo ticket liberado; autorização funcional permanece nos
  tickets `PROT-030` a `PROT-032`;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

## 2026-08-26 — PROT-017 — Criar estrutura de roles e permissions

Status: Concluído

### Resultado

O schema passa a representar RBAC contextual com catálogos globais de papéis e
permissões, relação N:N entre ambos e atribuição de papel à conta nos escopos
global, organizacional ou de unidade. O contexto pertence à atribuição, por isso
a mesma conta pode exercer o mesmo papel em organizações diferentes.

Checks nomeados validam códigos, estado de papel de sistema, versão e coerência
do escopo. A unicidade contextual usa `NULLS NOT DISTINCT` e rejeita também a
duplicidade global; chaves estrangeiras restritivas preservam relações
referenciadas. A consulta de permissões combina atribuições globais, da
organização e da unidade, ignora papéis inativos e possui caminho indexado.

### Arquivos e dados

- criado `packages/models/authorization.ts` com `roles`, `permissions`,
  `rolePermissions` e `accountRoles`, tipos públicos, nomes estáveis de
  constraints/índices e identificação explícita de papel mutável;
- `roles` possui sete colunas, optimistic locking, código único e proteção do
  estado de sistema; `permissions` possui três colunas e código único no formato
  exato `<recurso>.<ação>`;
- `role_permissions` usa PK composta e duas FKs restritivas; `account_roles`
  possui seis colunas, FKs restritivas para conta/papel, unicidade contextual,
  check que impede unidade órfã e dois índices secundários;
- gerada por diff real a migration estrutural
  `20260827004636_create_authorization_structure.sql`, com sete instruções, sem
  catálogo, seed, dado, default UUID, soft delete ou operação destrutiva; o
  checksum Atlas foi atualizado;
- adicionados cinco testes de model/migration e duas integrações PostgreSQL
  reais para herança contextual, múltiplas organizações, papel inativo/sistema,
  constraints, FKs, remoção referenciada e plano do índice;
- reescrito `docs/permissions/README.md` com diagrama, dicionário, escopos,
  herança, índices e limites dos tickets futuros; criado o `ADR-005` para a
  fundação de RBAC contextual;
- nenhuma versão de dependência ou lockfile foi alterada; não foram criados
  catálogo, seed, dado, rota, repository, middleware ou decisão funcional de
  autorização.

### Validação

- migration completa em base temporária criada de `template0`: cinco
  migrations e 30 instruções aplicadas; segunda execução sem pendências; 14
  tipos, 55 labels e seis tabelas, todas com zero registros; a base foi removida
  ao final;
- `atlas migrate validate`, `status` e `diff` no ambiente `prod`: checksum
  válido, versão `20260827004636`, cinco arquivos executados, zero pendências e
  zero drift;
- `pnpm model:reference:validate` e `pnpm model:reference:diff`: fixture de
  convenções válido e sem drift;
- `pnpm --filter @protege-mais/plugins test:database`: 13 testes reais
  aprovados, incluindo os dois cenários de RBAC e os baselines de contas,
  sessões, enums, Drizzle/UTC, PostGIS/SRID/distância e retomada/shutdown;
- `pnpm test`: 93 testes aprovados em sete workspaces;
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

- os catálogos de papel e permissão são globais; o escopo fica exclusivamente
  na atribuição da conta;
- `organization_id` e `organization_unit_id` são UUIDs reservados sem FK porque
  as tabelas de destino pertencem a `PROT-019` e `PROT-020`; esses tickets devem
  adicionar as referências por migration forward antes do uso em runtime;
- papéis de sistema permanecem ativos; mutações suportadas devem filtrar
  `is_system = false` e a versão esperada, e operações administrativas fora da
  aplicação ficam no fluxo controlado de migration/manutenção;
- o `PROT-018` é o próximo ticket liberado e criará o catálogo/seed versionado;
  vínculos e autorização funcional permanecem nos tickets próprios;
- o aviso não bloqueante de bundle Web maior que 500 kB permanece fora deste
  ticket.

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
