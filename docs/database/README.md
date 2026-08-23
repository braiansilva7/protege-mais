# Banco de dados

## Estado atual

Após `PROT-000`, o schema Drizzle está vazio e não existem migrations ou seeds
SQL. O banco local não foi recriado. Nenhuma tabela de domínio está disponível.

As pastas `atlas/prod` e `atlas/seed/dev` são mantidas com `.gitkeep` para
preservar a estrutura sem introduzir dados.

## Arquitetura-alvo

- PostgreSQL em UTC;
- UUID v7 gerado pela aplicação;
- `TIMESTAMPTZ` para instantes;
- PostGIS e SRID 4326 para geolocalização;
- Drizzle como modelagem e Atlas como migration;
- migration estrutural independente de seed;
- banco em `snake_case` e TypeScript em `camelCase`.

## Próximos responsáveis

- `PROT-011`: consolidar conexão, Drizzle e Atlas;
- `PROT-012`: habilitar PostGIS;
- `PROT-013`: definir convenções e checklist de migration.

Até esses tickets, nenhum documento deve afirmar que o banco-base do produto
está implementado.
