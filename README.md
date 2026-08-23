# Protege Mais

Base inicial do projeto **Protege Mais**.

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
