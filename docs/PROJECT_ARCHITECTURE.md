# Arquitetura atual do Protege Mais

## Estado

Este documento registra somente o que existe após o `PROT-001`. A arquitetura
futura permanece em `docs/architecture/TARGET_ARCHITECTURE.md` e não deve ser
confundida com funcionalidade já entregue.

O monorepo possui quatro apps executáveis e dez packages compartilhados. Ainda
não existem domínio de negócio, autenticação, autorização, tabelas, migrations,
seeds, Redis ou filas.

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
│   │       └── server.ts
│   ├── worker/               # Processo ocioso aguardando infraestrutura
│   │   └── src/index.ts
│   ├── web/                  # Shell institucional Vue
│   │   └── src/
│   └── mobile/               # Shell Expo/React Native
│       ├── App.tsx
│       └── index.ts
├── packages/
│   ├── common/               # Tipos, enums, constantes e funções comuns
│   ├── config/               # Leitura de configuração existente
│   ├── interfaces/           # Contratos de entrada compartilhados
│   ├── middlewares/          # Middlewares compartilhados futuros
│   ├── models/               # Schema Drizzle, atualmente vazio
│   ├── plugins/              # Banco, CORS, multipart e i18n existentes
│   ├── repositories/         # Persistência por domínio futura
│   ├── schema/               # Contratos HTTP; hoje somente health
│   ├── services/             # Capacidades reutilizáveis futuras
│   └── useCases/             # Orquestração de casos de uso futura
├── atlas/
│   ├── prod/                 # Vazio
│   └── seed/dev/             # Vazio
└── docs/
```

## Workspaces e dependências

O `pnpm-workspace.yaml` reconhece `apps/*` e `packages/*`. Todos usam o namespace
`@protege-mais/`; o app HTTP é publicado internamente como
`@protege-mais/manager-api`, apesar de sua pasta continuar `manager_api`.

Cada package possui `package.json` e `index.ts` como fronteira pública. Nesta
fase eles são workspaces de código-fonte: o Manager API compila os packages que
consome, enquanto packages vazios permanecem como entrypoints preparados para
os tickets de domínio. Configuração TypeScript comum mais ampla, lint e regras de
qualidade pertencem ao `PROT-002`.

As dependências seguem uma única direção:

```text
apps → packages
```

Packages não importam nem declaram dependência de apps. Dependências externas
ficam no workspace que as utiliza; a raiz mantém somente ferramentas do
monorepo e de banco.

Os aliases compartilhados usam os nomes dos workspaces, por exemplo:

```text
@protege-mais/common
@protege-mais/config
@protege-mais/plugins
@protege-mais/schema
```

O alias legado `@core/*` não existe mais. Aliases locais de UI permanecem
restritos ao respectivo app.

## Responsabilidade dos apps

| App           | Responsabilidade atual                      | Não faz neste baseline              |
| ------------- | ------------------------------------------- | ----------------------------------- |
| `manager_api` | Expõe health, Swagger e o prefixo `/api/v1` | Regra de negócio, auth ou permissão |
| `web`         | Serve o shell institucional estático        | Chamada de API ou fluxo funcional   |
| `mobile`      | Inicia o shell Expo/React Native            | Storage, API ou fluxo de proteção   |
| `worker`      | Mantém processo ocioso e encerra por sinal  | Redis, filas, processors ou jobs    |

O worker usa um timer referenciado de longa duração apenas para manter o event
loop ativo, sem polling ou busy loop. `SIGINT` e `SIGTERM` cancelam a espera e
encerram o shell. Redis e processamento assíncrono serão implementados por
`PROT-009` e `PROT-010`.

## API

O bootstrap Fastify registra, nesta ordem:

1. pool PostgreSQL/Drizzle;
2. parser multipart;
3. CORS;
4. i18n;
5. Swagger;
6. `GET /health`;
7. agregador vazio sob `/api/v1`.

Não há JWT, middleware de autenticação, usuário autenticado ou permissão no
baseline. Esses componentes serão redesenhados em seus tickets próprios.

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

| Comando                   | Resultado                              |
| ------------------------- | -------------------------------------- |
| `pnpm dev`                | Inicia os quatro apps pelo Turbo       |
| `pnpm dev:manager_api`    | Inicia somente a API                   |
| `pnpm dev:web`            | Inicia somente o Web                   |
| `pnpm dev:mobile`         | Inicia somente o Mobile                |
| `pnpm dev:worker`         | Inicia somente o worker ocioso         |
| `pnpm typecheck`          | Valida os quatro apps a partir da raiz |
| `pnpm build`              | Gera os quatro builds a partir da raiz |
| `pnpm -r list --depth -1` | Lista raiz, quatro apps e dez packages |

## Inventário e recuperação

A classificação do legado removido permanece em
`docs/implementation/PROT-000_LEGACY_INVENTORY.md`. Os arquivos removidos são
recuperáveis pelo histórico Git; o `PROT-001` não criou nem alterou dados.

---

Documentação Protege Mais — Arquitetura atual
