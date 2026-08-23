# Banco de dados

## Estado atual

Os models e migrations ainda refletem o template anterior. Eles permanecem
registrados em `docs/PROJECT_ARCHITECTURE.md` somente para orientar o saneamento
de `PROT-000`. Não devem ser usados como base para novos domínios.

## Arquitetura-alvo

- PostgreSQL em UTC;
- UUID v7 gerado pela aplicação;
- `TIMESTAMPTZ` para instantes;
- PostGIS e SRID 4326 para geolocalização;
- Drizzle como modelagem e Atlas como migration;
- migration estrutural independente de seed;
- banco em `snake_case` e TypeScript em `camelCase`.

## Atualização obrigatória

Cada ticket de persistência deve adicionar aqui ou em documentos específicos:

- tabela, propósito e classificação dos dados;
- colunas, constraints, índices e relações;
- política de atualização, soft delete e retenção;
- migration correspondente e procedimento de validação;
- diagrama atualizado;
- riscos de concorrência, volume e isolamento organizacional.

O dicionário definitivo começa em `PROT-013`; até lá, este arquivo não afirma
que tabelas-alvo já existam.
