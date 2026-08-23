# Catálogo da API

## Estado atual

As rotas existentes de login, usuário e papéis pertencem à base herdada e serão
avaliadas em `PROT-000`. A API-alvo usa `/api/v1` para negócio, `/health` para
liveness e `/ready` para readiness.

## Regra de atualização

Cada rota implementada deve documentar:

- método, path, finalidade e permissão;
- autenticação e escopos de organização/unidade;
- body, params, query e responses;
- códigos de erro estáveis;
- idempotência e concorrência, quando aplicável;
- efeitos síncronos, eventos e jobs publicados;
- exemplo fictício sem PII ou segredo.

O OpenAPI gerado em `PROT-007` é o contrato técnico principal. Este catálogo
explica decisões e fluxos que não cabem no schema.

## Rotas-base planejadas

| Rota                            | Ticket   | Estado                   |
| ------------------------------- | -------- | ------------------------ |
| `GET /health`                   | PROT-006 | Pendente de consolidação |
| `GET /ready`                    | PROT-006 | Pendente                 |
| `POST /api/v1/emergency-alerts` | PROT-046 | Pendente                 |
