# Protege Mais

Fundação técnica do **Protege Mais**.

O legado foi removido pelo `PROT-000`, a estrutura do monorepo foi consolidada
pelo `PROT-001`, a qualidade comum foi entregue pelo `PROT-002` e as variáveis
de ambiente foram centralizadas pelo `PROT-003`. O `PROT-004` acrescentou o
padrão global de erros da API. Neste baseline não existem tabelas, dados,
autenticação, permissões ou rotas de negócio. API, Worker, Web e Mobile
permanecem como shells mínimos para evolução incremental.

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

O Worker permanece ocioso até receber `SIGINT` ou `SIGTERM`. Ele ainda não
conecta ao Redis e não processa filas ou jobs.

## Qualidade e build

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Lint e typecheck cobrem os quatro apps e os dez packages. Os testes atuais
cobrem a validação centralizada, as classes de erro e o handler Fastify; o build
cobre Manager API, Worker, Web e Mobile. Use `pnpm format` para aplicar a
formatação e `pnpm -r --if-present format:check` para conferir cada workspace
explicitamente. As regras de TypeScript, ESLint, Prettier e uso excepcional de
`any` estão em [`docs/QUALITY.md`](docs/QUALITY.md).

## Estado atual da API

- `GET /health` — shell de saúde da aplicação;
- `/swagger/` — documentação do contrato atual;
- `/api/v1` — reservado para futuras rotas de negócio, atualmente vazio.

Falhas HTTP usam o contrato comum `{ code, message, requestId }`; stack, causa e
detalhes de validação não fazem parte da resposta. A tabela de mapeamentos e as
regras de uso estão em [`docs/api/README.md`](docs/api/README.md).

PostgreSQL, Atlas e MinIO permanecem configurados como infraestrutura local,
mas não há migrations nem seeds de domínio. A fundação de banco será
consolidada em `PROT-011`.

## Documentação e tickets

- Índice: [`docs/README.md`](docs/README.md)
- Roadmap: [`docs/product/ROADMAP.md`](docs/product/ROADMAP.md)
- Tickets: [`docs/tickets/README.md`](docs/tickets/README.md)
- Arquitetura atual:
  [`docs/PROJECT_ARCHITECTURE.md`](docs/PROJECT_ARCHITECTURE.md)
- Arquitetura-alvo:
  [`docs/architecture/TARGET_ARCHITECTURE.md`](docs/architecture/TARGET_ARCHITECTURE.md)

O próximo ticket é `PROT-005`:

```text
Implemente o ticket PROT-005 seguindo toda a documentação do projeto.
```
