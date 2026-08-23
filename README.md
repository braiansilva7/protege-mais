# Protege Mais

Fundação técnica do **Protege Mais**.

O legado do template de origem foi removido pelo `PROT-000`. Neste baseline não
existem tabelas, dados, autenticação, permissões ou rotas de negócio. API, Web e
Mobile permanecem como shells mínimos para que a nova arquitetura seja criada e
testada de forma incremental.

## Pré-requisitos

- Node.js `24.12.0`;
- pnpm `11.9.0`;
- Docker, apenas para os tickets que usam infraestrutura local.

## Início rápido dos shells

1. Copie `.env.example` para `.env` e ajuste valores locais.
2. Instale as dependências: `pnpm install`.
3. Inicie a API: `pnpm dev:manager_api`.
4. Em outro terminal, inicie o Web: `pnpm dev:web`.

O Mobile pode ser iniciado com `pnpm dev:mobile`.

## Estado atual da API

- `GET /health` — shell de saúde da aplicação;
- `/swagger/` — documentação do contrato atual;
- `/api/v1` — reservado para futuras rotas de negócio, atualmente vazio.

O PostgreSQL, Atlas e MinIO permanecem configurados como infraestrutura local,
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

O próximo ticket é `PROT-001`. Para continuar por etapas:

```text
Implemente o ticket PROT-001 seguindo toda a documentação do projeto.
```
