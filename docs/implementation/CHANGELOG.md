# Registro de implementação

Este arquivo registra somente mudanças efetivamente realizadas. Planos futuros
ficam no roadmap e nos tickets.

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
