# Catálogo da API

## Estado atual

O baseline não possui rotas de autenticação, usuários, papéis ou negócio.

| Rota          | Autenticação | Estado                       | Observação                             |
| ------------- | ------------ | ---------------------------- | -------------------------------------- |
| `GET /health` | Não          | Disponível                   | Retorna `{ "status": "ok" }`           |
| `/swagger/`   | Não          | Disponível no baseline local | Documenta somente o contrato atual     |
| `/api/v1/*`   | —            | Sem rotas                    | Prefixo reservado para tickets futuros |

`GET /ready` será criado em `PROT-006` e não deve ser simulado antes disso.

## Regra de atualização

Cada rota implementada deve documentar:

- método, path, finalidade e permissão;
- autenticação e escopos de organização/unidade;
- body, params, query e responses;
- códigos de erro estáveis;
- idempotência e concorrência, quando aplicável;
- efeitos síncronos, eventos e jobs publicados;
- exemplo fictício sem PII ou segredo.

O OpenAPI consolidado em `PROT-007` será o contrato técnico principal. Este
catálogo explica decisões e fluxos que não cabem no schema.
