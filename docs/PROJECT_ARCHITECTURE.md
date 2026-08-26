# Arquitetura atual do Protege Mais

## Estado

Este documento registra somente o que existe após o `PROT-009`. A arquitetura
futura permanece em `docs/architecture/TARGET_ARCHITECTURE.md` e não deve ser
confundida com funcionalidade já entregue.

O monorepo possui quatro apps executáveis e dez packages compartilhados. Ainda
não existem domínio de negócio, autenticação, autorização, tabelas, migrations,
seeds ou filas. Redis já é uma dependência compartilhada com namespace por
ambiente, reconexão, timeouts e encerramento gracioso. A API possui contrato
global de erros,
internacionalização em `pt-BR`, `en` e `es`, liveness, readiness extensível,
encerramento gracioso e logs JSON correlacionados. Seus contratos HTTP geram
OpenAPI 3.1 e a exposição do Swagger segue uma política por ambiente, sem ativar
as integrações futuras. O Worker usa o mesmo logger seguro e possui a fronteira
de correlação preparada para jobs futuros.

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
│   ├── worker/               # Shell conectado ao Redis, ainda sem filas
│   │   └── src/
│   │       ├── app.ts         # Shell e contexto correlacionado de jobs
│   │       ├── lifecycle.ts   # Espera e remoção de sinais
│   │       └── index.ts       # Entrada do processo
│   ├── web/                  # Shell institucional Vue
│   │   └── src/
│   └── mobile/               # Shell Expo/React Native
│       ├── App.tsx
│       └── index.ts
├── packages/
│   ├── common/               # Erros, constantes e funções comuns
│   ├── config/               # Configuração validada, tipada e imutável
│   ├── interfaces/           # Contratos de entrada compartilhados
│   ├── middlewares/          # Middlewares compartilhados futuros
│   ├── models/               # Schema Drizzle, atualmente vazio
│   ├── plugins/              # Logging, erros, readiness, Redis e plugins Fastify
│   ├── repositories/         # Persistência por domínio futura
│   ├── schema/               # Fonte oficial dos contratos HTTP e OpenAPI
│   ├── services/             # Capacidades reutilizáveis futuras
│   └── useCases/             # Orquestração de casos de uso futura
├── atlas/
│   ├── prod/                 # Vazio
│   └── seed/dev/             # Vazio
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
tipo HTTP compartilhado de `schema`. `schema` depende somente do TypeBox e não
depende de `common`; assim, contratos de transporte não criam ciclo com regras
de erro.

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

| App           | Responsabilidade atual                                  | Não faz neste baseline              |
| ------------- | ------------------------------------------------------- | ----------------------------------- |
| `manager_api` | Config, Redis, logs, probes, OpenAPI, erros e `/api/v1` | Regra de negócio, auth ou permissão |
| `web`         | Valida config pública e serve o shell                   | Chamada de API ou fluxo funcional   |
| `mobile`      | Valida config pública e inicia o shell Expo             | Storage, API ou fluxo de proteção   |
| `worker`      | Config, Redis, logs e espera graciosa por sinal         | Filas, processors ou jobs           |

O worker usa um timer referenciado de longa duração apenas para manter o event
loop ativo, sem polling ou busy loop. Ele inicia a conexão Redis compartilhada;
`SIGINT` e `SIGTERM` cancelam a espera, fecham a conexão e encerram o shell.
Filas e processamento assíncrono serão implementados pelo `PROT-010`.

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
exige conexão pronta e `PING` dentro do timeout; indisponibilidade e retomada são
refletidas sem reiniciar a API. PostgreSQL será registrado no `PROT-011`. Os
detalhes internos dos probes não entram na resposta.

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
Worker pode criar um logger de job que preserva `correlationId` e gera um novo
`requestId` por tentativa.

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

O Compose fornece Redis local com AOF, healthcheck e volume próprio. A
capacidade oferece comandos mínimos de `get`, `set`, expiração e exclusão; não
cria filas, locks de domínio ou caches antes dos tickets consumidores. Usos
permitidos e operação estão em `docs/REDIS.md`.

## Web e Mobile

O Web contém uma página estática traduzida informando que a fundação está em
preparação. O Mobile contém somente o shell Expo/React Native. Nenhum dos dois
chama API, persiste token ou oferece fluxo funcional.

## Banco e Atlas

`packages/models/index.ts` exporta um schema vazio. `atlas/prod` e
`atlas/seed/dev` não contêm SQL nem checksums. A integração PostgreSQL/Drizzle
continua preservada como capacidade genérica, mas sua consolidação pertence ao
`PROT-011`.

## Comandos do monorepo

| Comando                                          | Resultado                                                |
| ------------------------------------------------ | -------------------------------------------------------- |
| `pnpm dev`                                       | Inicia os quatro apps pelo Turbo                         |
| `pnpm dev:manager_api`                           | Inicia somente a API                                     |
| `pnpm dev:web`                                   | Inicia somente o Web                                     |
| `pnpm dev:mobile`                                | Inicia somente o Mobile                                  |
| `pnpm dev:worker`                                | Inicia somente o worker ocioso                           |
| `pnpm lint`                                      | Valida os quatro apps e os dez packages                  |
| `pnpm typecheck`                                 | Valida os quatro apps e os dez packages                  |
| `pnpm test`                                      | Testa config, Redis, erros, i18n, logs, probes e OpenAPI |
| `pnpm --filter @protege-mais/plugins test:redis` | Integra Redis real, TTL e reconexão                      |
| `pnpm format:check`                              | Confere a formatação do repositório                      |
| `pnpm -r --if-present format:check`              | Confere a formatação por workspace                       |
| `pnpm build`                                     | Gera os quatro builds a partir da raiz                   |
| `pnpm -r list --depth -1`                        | Lista raiz, quatro apps e dez packages                   |

## Inventário e recuperação

A classificação do legado removido permanece em
`docs/implementation/PROT-000_LEGACY_INVENTORY.md`. Os arquivos removidos são
recuperáveis pelo histórico Git; o `PROT-009` não criou tabelas, migrations ou
dados de domínio. O volume Redis local contém somente dados técnicos efêmeros.

---

Documentação Protege Mais — Arquitetura atual
