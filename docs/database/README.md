# Banco de dados

## Estado atual

O `PROT-011` consolidou PostgreSQL, Drizzle e Atlas como a fundação oficial de
persistência. O `PROT-012` acrescentou PostGIS por migration estrutural
idempotente. O `PROT-013` congelou as convenções de models e migrations. O
`PROT-014` criou os enums fundamentais com uma fonte de valores compartilhada
entre TypeScript e Drizzle. A Manager API possui pool gerenciado, probe
obrigatório e shutdown idempotente. O schema ainda não possui tabelas, seeds ou
dados de domínio; possui 14 tipos enum nativos para os tickets consumidores.

`packages/models/index.ts` é a única entrada do schema Drizzle de produção e
exporta os helpers e `pgEnum` comuns, mas ainda nenhuma tabela. `atlas/prod`
mantém as migrations `20260826000000_enable_postgis.sql` e
`20260826231424_fundamental_enums.sql`; `atlas/seed/dev` permanece sem dados.
Uma base nova aceita `migrate` sem exigir seed, habilita a extensão, cria os 14
tipos e permanece sem tabelas de domínio; `spatial_ref_sys` é um objeto interno
gerenciado pelo próprio PostGIS.

O guia normativo está em [CONVENTIONS.md](CONVENTIONS.md), o checklist de cada
mudança estrutural está em
[MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md) e a decisão correspondente foi
registrada no
[ADR-002](../decisions/ADR-002-database-conventions.md). Os nomes, labels,
significados e regras de evolução dos enums estão em
[ENUM_CATALOG.md](ENUM_CATALOG.md) e no
[ADR-003](../decisions/ADR-003-native-postgresql-enums.md).

## Conexão da aplicação

`packages/plugins/database` cria um `pg.Pool` por aplicação e entrega o mesmo
cliente Drizzle nos aliases `DatabaseRw` e `DatabaseRo`. Eles compartilham o
pool neste estágio; uma réplica de leitura só pode ser introduzida por decisão
posterior.

Configuração atual da Manager API:

| Parâmetro                           | Valor                      |
| ----------------------------------- | -------------------------- |
| `application_name`                  | `protege-mais:manager-api` |
| máximo de conexões                  | 10                         |
| mínimo de conexões                  | 0                          |
| timeout de conexão                  | 2 segundos                 |
| descarte de conexão ociosa          | 30 segundos                |
| query, statement e transação ociosa | 5 segundos                 |
| timezone de cada sessão             | `UTC`                      |

O pool é lazy, mas o bootstrap inicia uma primeira `SELECT 1` sem bloquear o
listener. O probe `postgresql` executa uma consulta limitada a cada readiness:
falha ou queda retorna `false`, e uma conexão posterior permite retomada sem
reiniciar a API. `SIGINT`, `SIGTERM` e `app.close()` marcam readiness como
indisponível e aguardam `pool.end()` uma única vez.

`DATABASE_URL`, mensagens originais do driver e credenciais não entram nos
eventos. Os únicos metadados de falha são `event` e `errorType` sintético.

## Setup local

1. Copie `.env.example` para `.env` e mantenha credenciais apenas locais.
2. Inicie as dependências de banco:

   ```bash
   docker compose up -d --wait db atlas-db
   ```

3. Aplique somente as migrations estruturais:

   ```bash
   pnpm migrate:local
   ```

4. Valide a conexão real, enums, Drizzle, UTC, indisponibilidade e retomada:

   ```bash
   pnpm --filter @protege-mais/plugins test:database
   ```

A porta do PostgreSQL local é publicada somente em `127.0.0.1:5432`. O
container inicia servidor e log timezone em UTC, inclusive quando um volume já
existente foi inicializado com outro fuso. Não use `docker compose down -v` em
um volume com dados que precisem ser preservados.

## PostGIS e convenções espaciais

Os serviços `db` e `atlas-db` usam a imagem oficial
`postgis/postgis:16-3.5-alpine`. Ela preserva a major PostgreSQL 16 e torna os
arquivos da extensão disponíveis tanto no banco principal quanto no banco de
desenvolvimento do Atlas. Trocar a imagem não habilita a extensão em volumes já
existentes; `pnpm migrate:local` continua obrigatório.

A migration verifica `pg_available_extensions` antes de executar exatamente:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Se o servidor não oferecer PostGIS, o apply falha com SQLSTATE `0A000`, uma
mensagem que identifica a ausência da extensão e um `HINT` para instalar
PostGIS ou usar uma imagem compatível. A migration pode ser executada novamente
sem recriar a extensão. Não existe rollback automático com `DROP EXTENSION`:
removê-la se tornará destrutivo assim que tipos espaciais forem referenciados.
Em validações descartáveis, reverta removendo somente a base temporária criada
para o teste.

Convenções espaciais congeladas pelo `PROT-012`:

- dados geográficos usam SRID 4326;
- pontos futuros usam `geography(Point, 4326)` quando distâncias na superfície
  terrestre forem necessárias;
- a ordem de entrada é longitude, latitude; longitude fica entre -180 e 180 e
  latitude entre -90 e 90;
- `ST_Distance` entre valores `geography` retorna metros;
- índices espaciais, constraints e models pertencem ao ticket da tabela que os
  consumir;
- coordenadas, distâncias ligadas a pessoas e locais protegidos nunca entram em
  logs comuns.

A integração `test:database` detecta as versões instalada e carregada, confirma
SRID 4326 e calcula a distância geodésica conhecida entre dois pontos no
equador. Ela deve ser executada somente depois da migration estrutural.

## Fluxo Atlas

`atlas.hcl` oferece três ambientes:

- `prod`: estado desejado Drizzle → `atlas/prod`, somente estrutura;
- `dev`: estado desejado Drizzle → `atlas/seed/dev`, somente dados fictícios de
  desenvolvimento, aplicados depois de `prod` e em ordem não linear;
- `reference`: fixture Drizzle isolado → `packages/models/reference/atlas`, sem
  URL de deploy e sem export pelo schema de produção.

O Atlas recebe `DB_DATABASE_URL` e `DB_ATLAS` pelo ambiente do processo. O
estado desejado é exportado pelo binário local de `drizzle-kit` fixado no
lockfile; nenhuma instalação ou alteração de `node_modules` ocorre durante o
diff. A imagem local fixa Node.js `24.12.0` e Atlas `v1.3.0`.

| Objetivo                                   | Comando                                  |
| ------------------------------------------ | ---------------------------------------- |
| subir infraestrutura local                 | `pnpm db:up`                             |
| gerar diff estrutural                      | `ENV=prod pnpm atlas:diff:docker`        |
| recalcular checksum após edição deliberada | `ENV=prod pnpm atlas:hash:docker`        |
| validar diretório estrutural               | `ENV=prod pnpm atlas:validate:docker`    |
| aplicar estrutura local                    | `pnpm migrate:local`                     |
| consultar estado local                     | `ENV=prod pnpm atlas:status:docker`      |
| aplicar estrutura em DEV/PROD              | `pnpm migrate:dev` / `pnpm migrate:prod` |
| aplicar estrutura e seed fictício local    | `pnpm seed:local`                        |
| criar arquivo vazio de seed local          | `pnpm seed:new:local`                    |
| inspecionar DDL do model de referência     | `pnpm model:reference:export`            |
| validar migration de referência            | `pnpm model:reference:validate`          |
| confirmar zero drift na referência         | `pnpm model:reference:diff`              |

Ao adicionar um model futuro:

1. exporte-o por `packages/models/index.ts`;
2. gere o diff em `prod` e revise todo SQL;
3. confirme que seed não é referenciado pela migration;
4. valide `atlas.sum` e aplique em uma base limpa;
5. aplique novamente e confirme zero pendências/drift;
6. registre forward/rollback compatível com a estratégia vigente do ticket;
7. complete todos os itens de
   [MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md).

`atlas migrate apply` nunca recalcula o checksum. `hash` pertence à autoria e
`apply` verifica a integridade versionada antes do deploy. Um seed não corrige
schema e nunca é pré-requisito de migration.

## Padrões congelados nesta fundação

- PostgreSQL e todas as sessões operam em UTC;
- instantes de domínio futuros usam `TIMESTAMPTZ(3)`;
- UUID v7 é gerado pela aplicação, não pelo relógio do banco;
- Drizzle é a fonte tipada dos models e Atlas é a fonte do histórico aplicado;
- banco usa `snake_case` e TypeScript usa `camelCase`;
- constraints e índices usam nomes determinísticos e FKs declaram suas ações;
- tabelas mutáveis usam optimistic locking como baseline;
- soft delete é opt-in e nunca é aplicado automaticamente a `audit_logs`,
  `alert_events` ou `risk_assessments`;
- enums nativos reutilizam tuples TypeScript, não possuem defaults implícitos e
  não usam ordem física como regra de negócio.

PostGIS está habilitado e consultas espaciais usam SRID 4326. O fixture em
`packages/models/reference` prova nomes, mapeamento, nulabilidade, concorrência
e soft delete sem criar entidade de domínio. O catálogo fundamental possui 14
tipos e nenhuma tabela consumidora. O próximo ticket liberado, `PROT-015`, pode
usar os enums de conta ao criar `accounts`.

---

Documentação Protege Mais — PostgreSQL, Drizzle e Atlas
