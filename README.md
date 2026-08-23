# Protege Mais

Fundação técnica do **Protege Mais**.

O legado foi removido pelo `PROT-000` e a estrutura do monorepo foi consolidada
pelo `PROT-001`. Neste baseline não existem tabelas, dados, autenticação,
permissões ou rotas de negócio. API, Worker, Web e Mobile permanecem como shells
mínimos para evolução incremental.

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
pnpm typecheck
pnpm build
pnpm format:check
```

Os comandos de typecheck e build da raiz cobrem Manager API, Worker, Web e
Mobile. A consolidação de lint e da configuração TypeScript comum pertence ao
`PROT-002`.

## Estado atual da API

- `GET /health` — shell de saúde da aplicação;
- `/swagger/` — documentação do contrato atual;
- `/api/v1` — reservado para futuras rotas de negócio, atualmente vazio.

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

O próximo ticket é `PROT-002`:

```text
Implemente o ticket PROT-002 seguindo toda a documentação do projeto.
```
