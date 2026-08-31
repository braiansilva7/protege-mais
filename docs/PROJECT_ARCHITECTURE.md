# Arquitetura atual do Protege Mais

## Estado

Este documento registra somente o que existe após o `PROT-023`. A arquitetura
futura permanece em `docs/architecture/TARGET_ARCHITECTURE.md` e não deve ser
confundida com funcionalidade já entregue.

O monorepo possui quatro apps executáveis e dez packages compartilhados. A
persistência possui `accounts`, separada de perfis e protegida por constraints
de identidade, `auth_sessions`, com credencial em hash, metadata minimizada e
ciclo de expiração/revogação, `organizations`, com identidade institucional,
localidade e ciclo de ativação/soft delete, `organization_units`, com endereço,
posição geográfica e ownership contextual, `organization_members`, com
pertencimento organizacional/de unidade e vigência, e quatro tabelas que formam
a base relacional do RBAC contextual. Projeções seguras excluem hashes, CNPJ,
contato, endereço, localização, matrícula e chaves internas. A rota pública de
login valida credenciais com Argon2id e resposta uniforme sob rate limit Redis,
falha fechada para contas com MFA e emite JWT de acesso de 15 minutos. O token
carrega somente conta e sessão lógica; ainda não existe refresh token, sessão
funcional persistida, middleware de autenticação, autorização, outras rotas de
negócio ou dados operacionais. Um catálogo TypeScript contém as 19
permissões iniciais e o
seed opcional de desenvolvimento insere somente esses códigos, sem
papéis ou atribuições. Existem 14 tipos enum fundamentais, com `account_type`,
`account_status` e `organization_type` já consumidos por tabelas.
PostGIS está habilitado pela primeira migration estrutural, validado com SRID
4326 e consumido por pontos de unidade indexados com GiST. As convenções de
persistência estão congeladas e comprovadas por um fixture Drizzle/Atlas isolado
do schema de produção. Redis já é uma dependência compartilhada com namespace
por ambiente, reconexão, timeouts e encerramento gracioso. As cinco filas base
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
│   │       ├── controllers/       # Health e autenticação HTTP
│   │       ├── plugins/           # Composição auth e Swagger
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
│   ├── common/               # Enums, permissões, senha, normalizações e UUID
│   ├── config/               # Configuração validada, tipada e imutável
│   ├── interfaces/           # Contratos de entrada compartilhados
│   ├── middlewares/          # Rate limit de autenticação
│   ├── models/               # Identidade, organizações, vínculos, RBAC e enums
│   ├── plugins/              # Banco, logging, Redis, filas e plugins Fastify
│   ├── repositories/         # Adaptadores de persistência por domínio
│   ├── schema/               # Fonte oficial dos contratos HTTP e OpenAPI
│   ├── services/             # Hash, JWT, auditoria e capacidades reutilizáveis
│   └── useCases/             # Credenciais, registry de jobs e orquestração
├── atlas/
│   ├── prod/                 # PostGIS, enums, identidade, organizações, vínculos e RBAC
│   └── seed/dev/             # Catálogo aditivo de permissões para desenvolvimento
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
Na autenticação, `interfaces` declara portas, `services` implementa
hash/auditoria/JWT, `repositories` adapta Drizzle, `middlewares` aplica o limite
distribuído e `useCases` orquestra essas abstrações sem importar banco, Argon2,
Redis ou transporte. A Manager API é a raiz de composição. `useCases` também
define a execução e a classificação de falhas de jobs sem importar o plugin de
filas.

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
Redis e `JWT_ACCESS_SECRET` são exigidos pela API, e Redis é exigido pelo Worker.
A matriz está em
`docs/CONFIGURATION.md`.

## Responsabilidade dos apps

| App           | Responsabilidade atual                              | Não faz neste baseline            |
| ------------- | --------------------------------------------------- | --------------------------------- |
| `manager_api` | Config, dependências, OpenAPI, login e entrada HTTP | Autorização ou regra de proteção  |
| `web`         | Valida config pública e serve o shell               | Chamada de API ou fluxo funcional |
| `mobile`      | Valida config pública e inicia o shell Expo         | Storage, API ou fluxo de proteção |
| `worker`      | Filas, processors, retry, logs e shutdown gracioso  | Regra de negócio ou persistência  |

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

O bootstrap valida ambiente, host, porta, log, CORS, banco, Redis e segredo JWT
de acesso antes de criar o Fastify. Depois registra, nesta ordem:

1. logging seguro e headers de correlação;
2. handler global de erros e de rota inexistente;
3. registry de readiness;
4. cliente Redis e seu probe;
5. pool PostgreSQL/Drizzle;
6. composição de autenticação e rate limit;
7. parser multipart;
8. CORS;
9. i18n;
10. Swagger;
11. `GET /health` e `GET /ready`;
12. rotas versionadas, incluindo `POST /api/v1/auth/login`.

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

`POST /api/v1/auth/login` é público e validado por schema. Seu pre-handler
consome cinco tentativas por 60 segundos em um contador Redis com chave HMAC
opaca e falha fechada. O caso de uso normaliza e-mail, verifica Argon2id
inclusive contra hash fictício quando a credencial não existe, exige conta
ativa, confirma o último login por escrita condicional e bloqueia MFA enquanto
não houver challenge. Em sucesso, `jose` assina um JWT HS256 de 15 minutos com
`sub`, `sid`, `iat`, `exp`, `iss`, `aud` e `token_use`; a resposta não expõe IDs
ou estado interno. O contrato completo está em
`docs/authentication/README.md`.

Ainda não há refresh token, sessão funcional persistida, middleware de
autenticação, usuário autenticado no request ou decisão de permissão. O catálogo
técnico não é consultado pelo runtime e não há papéis ou atribuições iniciais.

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
`get`, `set`, expiração, exclusão e incremento/TTL atômico; este último sustenta
o rate limit do login sem armazenar endereço bruto. A capacidade de filas usa o
prefixo adicional `queues` e conexões próprias, inclusive bloqueantes. Usos
permitidos e operação estão em `docs/REDIS.md` e `docs/WORKER_QUEUES.md`.

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

O mesmo entrypoint exporta `authSessions`, seus tipos, nomes de constraints e
índices, predicado de atividade e uma projeção que exclui hash de refresh
token, hash de IP e ID da conta. A tabela usa FK com exclusão restrita, hash
globalmente único, timestamps de expiração/uso/revogação, versionamento otimista
e checks de ciclo de vida. `packages/common` sanitiza nome de dispositivo e
User-Agent. O contrato completo está em
`docs/database/AUTH_SESSIONS.md`.

`packages/repositories/authentication` lê somente ID, hash, estado e indicador
de MFA de uma conta não excluída. A confirmação de login compara o hash
observado e o estado ativo antes de atualizar `last_login_at`, `updated_at` e
`version`, impedindo sucesso após troca de credencial, bloqueio ou soft delete
concorrente. Nenhuma migration foi necessária no `PROT-022`.

Também exporta `roles`, `permissions`, `rolePermissions` e `accountRoles`, seus
tipos e nomes estáveis de constraints/índices. Os catálogos são globais;
`account_roles` guarda atribuições globais, organizacionais ou de unidade e usa
`UNIQUE NULLS NOT DISTINCT` para rejeitar duplicidades em qualquer contexto.
Unidade sem organização é inválida, FKs existentes são restritivas e a busca
por conta/contexto possui índice composto. `organization_id` referencia
`organizations` com exclusão restrita; uma FK composta combina
`organization_id` e `organization_unit_id` e rejeita unidades inexistentes ou
de outra organização. O diagrama, o dicionário e as fronteiras de autorização
estão em `docs/permissions/README.md`; o `ADR-005` registra a fundação de RBAC.

O entrypoint exporta ainda `organizations`, seus tipos, nomes estáveis de
constraints/índices, predicado operacional e projeção pública sem CNPJ. Nomes
originais e normalizados, CNPJ numérico ou alfanumérico com dígitos
verificadores, UF e município IBGE são validados no banco. O CNPJ permanece
globalmente reservado após soft delete; três índices parciais atendem pesquisas
somente entre organizações ativas. Os normalizadores canônicos estão em
`packages/common/organizations`, o dicionário está em
`docs/database/ORGANIZATIONS.md` e o `ADR-006` registra as decisões de
identidade e ciclo de vida.

O entrypoint também exporta `organizationUnits`, seus tipos, nomes estáveis de
constraints/índices, predicado operacional e projeção pública sem contato,
endereço ou localização. Código é único dentro da organização e continua
reservado após soft delete. Longitude/latitude validadas geram sempre
`geography(Point,4326)`; o índice GiST atende proximidade em metros. Os
normalizadores estão em `packages/common/organization-units`, o dicionário em
`docs/database/ORGANIZATION_UNITS.md` e o `ADR-007` registra identidade,
endereço, posição e adaptação do export Atlas.

O entrypoint exporta `organizationMembers`, seus tipos, nomes estáveis de
constraints/índices, predicado local de vigência e projeção sem matrícula.
Conta e organização são obrigatórias; unidade é opcional e a FK composta rejeita
contexto divergente. `UNIQUE NULLS NOT DISTINCT` impede duplicidade inclusive
com unidade nula, enquanto o índice parcial atende memberships ativos por
conta. Matrícula/cargo opcionais são normalizados em
`packages/common/organization-members`. O dicionário está em
`docs/database/ORGANIZATION_MEMBERS.md` e o `ADR-008` registra cardinalidade,
ciclo de vida e separação de papel.

`packages/common/permissions` exporta `permissionCatalog`, `permissionCodes`,
os tipos literais de recurso/código e um type guard. O catálogo possui 19
códigos agrupados em `account`, `organization`, `victim` e `case`; ele é a
fonte TypeScript comparada automaticamente ao seed e ainda não concede acesso.

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
`CREATE EXTENSION IF NOT EXISTS postgis`, a migration dos 14 enums,
`20260826233758_create_accounts.sql`,
`20260827001526_create_auth_sessions.sql` e
`20260827004636_create_authorization_structure.sql` e
`20260830134040_create_organizations.sql` e
`20260830142030_create_organization_units.sql` e
`20260830144651_create_organization_members.sql`. O diretório de
desenvolvimento contém
`20260827012543_initial_permission_catalog.sql`, que insere as 19 permissões com
`ON CONFLICT (code) DO NOTHING`, sem papel ou atribuição. O apply não
recalcula hashes, uma base limpa aplica a estrutura sem seed e a repetição
permanece sem pendências ou drift. PostgreSQL principal e dev database do Atlas
usam `postgis/postgis:16-3.5-alpine`, iniciam em UTC, têm healthcheck, shutdown
gracioso e rede local; a porta publicada do banco é restrita a loopback. O
fluxo completo está em
`docs/database/README.md`.

O estado principal passa por `scripts/export-atlas-schema.mjs`. O adaptador
mantém o Drizzle fixado, corrige a renderização exata de
`geography(Point,4326)` e prepara a extensão somente em `DB_ATLAS`, descartável,
antes de o Atlas avaliar o schema. Migrations continuam sendo o único caminho
para alterar `DB_DATABASE_URL`.

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
| `pnpm test`                                         | Testa config, login/JWT, RBAC, filas e OpenAPI       |
| `pnpm --filter @protege-mais/plugins test:database` | Integra banco, memberships, RBAC, seed e PostGIS     |
| `pnpm --filter @protege-mais/plugins test:redis`    | Integra Redis real, TTL e reconexão                  |
| `pnpm --filter @protege-mais/worker test:redis`     | Integra filas, retry, idempotência, falha e shutdown |
| `pnpm format:check`                                 | Confere a formatação do repositório                  |
| `pnpm -r --if-present format:check`                 | Confere a formatação por workspace                   |
| `pnpm build`                                        | Gera os quatro builds a partir da raiz               |
| `pnpm migrate:local`                                | Aplica migrations estruturais Atlas localmente       |
| `pnpm seed:local`                                   | Aplica estrutura e seed aditivo de desenvolvimento   |
| `ENV=prod pnpm atlas:validate:docker`               | Valida o diretório estrutural e seu checksum         |
| `pnpm model:export`                                 | Exibe o DDL de produção adaptado para PostGIS        |
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
autenticação. O `PROT-016` adicionou somente `auth_sessions` e helpers seguros,
sem seed, dado, rota, emissão ou rotação de token. O `PROT-017` adicionou
somente as quatro tabelas de RBAC e helpers declarativos, sem catálogo, seed,
rotas, repository ou middleware de autorização. O `PROT-018` adicionou somente
o catálogo TypeScript e o seed de 19 permissões de desenvolvimento, sem papel,
atribuição, dado pessoal ou mudança estrutural de produção. O `PROT-019`
adicionou somente a identidade persistente de organizações e a FK
organizacional já prevista no RBAC, sem dado, seed, rota, repository ou
autorização funcional. O `PROT-020` adicionou somente unidades organizacionais,
normalizadores, posição geográfica e a FK contextual já prevista no RBAC, sem
dado, seed, rota, repository, membership ou autorização funcional. O
`PROT-021` adicionou somente memberships organizacionais/de unidade,
normalizadores e integridade relacional, sem dado, seed, rota, repository,
papel, atribuição ou autorização funcional. O `PROT-022` adicionou somente
contratos, política, Argon2id, auditoria mínima, repositório e caso de uso de
credenciais, sem migration, dado, rota, rate limit, token, sessão emitida ou
autorização. O `PROT-023` adicionou a rota pública, schemas, composição, rate
limit e access token curto, sem migration, dado, refresh token, linha de sessão,
middleware de autenticação ou autorização. A validação cria e remove somente uma
base temporária com nome
reservado; os volumes locais
não são apagados. O volume Redis local contém
somente metadados técnicos das filas e qualquer job fictício de teste é removido
ao concluir a integração.

---

Documentação Protege Mais — Arquitetura atual
