# Protege Mais

Base inicial do projeto **Protege Mais**.

> Estado atual: o repositório ainda contém domínios herdados do template de
> origem. A transição incremental começa pelo ticket `PROT-000`; não considere o
> modelo de dados atual como modelo final do produto.

Monorepo no padrão Underchat: Drizzle models + Atlas (prod/seed), packages `@core/*`,
`manager_api`, web admin e mobile.

## Início rápido

1. Copie `.env.example` para `.env` e ajuste os valores.
2. Suba infra: `pnpm db:up` (Postgres, Atlas shadow DB, MinIO e Atlas CLI).
3. Aplique schema + seed: `pnpm seed:local`.
4. API local: `pnpm dev:manager_api`.

MinIO console: `http://localhost:9003` (credenciais em `S3_ACCESS_KEY` / `S3_SECRET_KEY`).

## Rotas da manager_api

- `GET /health`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET|POST /api/v1/users`
- `PATCH|DELETE /api/v1/users/:id`

Create/update de usuário aceitam JSON ou `multipart/form-data` (campo `profile_picture`).

## Documentação e tickets

- Índice: [`docs/README.md`](docs/README.md)
- Roadmap: [`docs/product/ROADMAP.md`](docs/product/ROADMAP.md)
- Tickets: [`docs/tickets/README.md`](docs/tickets/README.md)
- Arquitetura-alvo:
  [`docs/architecture/TARGET_ARCHITECTURE.md`](docs/architecture/TARGET_ARCHITECTURE.md)

Para trabalhar por etapas, solicite apenas um ticket, por exemplo:

```text
Implemente o ticket PROT-000 seguindo toda a documentação do projeto.
```
