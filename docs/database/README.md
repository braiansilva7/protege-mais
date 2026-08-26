# Banco de dados

## Estado atual

O `PROT-011` consolidou PostgreSQL, Drizzle e Atlas como a fundação oficial de
persistência. A Manager API possui pool gerenciado, probe obrigatório e
shutdown idempotente. O schema central continua intencionalmente vazio: não há
tabelas, enums, migrations SQL, seeds ou dados de domínio neste incremento.

`packages/models/index.ts` é a única entrada do schema Drizzle. `atlas/prod`
mantém migrations estruturais e `atlas/seed/dev` mantém somente dados de
desenvolvimento. Os dois diretórios começam apenas com `atlas.sum` vazio; assim,
uma base nova aceita `migrate` sem exigir seed e permanece sem tabelas de
domínio.

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

4. Valide a conexão real, Drizzle, UTC, indisponibilidade e retomada:

   ```bash
   pnpm --filter @protege-mais/plugins test:database
   ```

A porta do PostgreSQL local é publicada somente em `127.0.0.1:5432`. O
container inicia servidor e log timezone em UTC, inclusive quando um volume já
existente foi inicializado com outro fuso. Não use `docker compose down -v` em
um volume com dados que precisem ser preservados.

## Fluxo Atlas

`atlas.hcl` oferece dois ambientes:

- `prod`: estado desejado Drizzle → `atlas/prod`, somente estrutura;
- `dev`: estado desejado Drizzle → `atlas/seed/dev`, somente dados fictícios de
  desenvolvimento, aplicados depois de `prod` e em ordem não linear.

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

Ao adicionar um model futuro:

1. exporte-o por `packages/models/index.ts`;
2. gere o diff em `prod` e revise todo SQL;
3. confirme que seed não é referenciado pela migration;
4. valide `atlas.sum` e aplique em uma base limpa;
5. aplique novamente e confirme zero pendências/drift;
6. registre forward/rollback compatível com a estratégia vigente do ticket.

`atlas migrate apply` nunca recalcula o checksum. `hash` pertence à autoria e
`apply` verifica a integridade versionada antes do deploy. Um seed não corrige
schema e nunca é pré-requisito de migration.

## Padrões congelados nesta fundação

- PostgreSQL e todas as sessões operam em UTC;
- instantes de domínio futuros usam `TIMESTAMPTZ`;
- UUID v7 é gerado pela aplicação, não pelo relógio do banco;
- Drizzle é a fonte tipada dos models e Atlas é a fonte do histórico aplicado;
- banco usa `snake_case` e TypeScript usa `camelCase`.

O `PROT-012` adicionará PostGIS. O `PROT-013` definirá nomes de constraints,
índices, nulabilidade, concorrência, soft delete e um model de referência; este
ticket não antecipou essas decisões.

---

Documentação Protege Mais — PostgreSQL, Drizzle e Atlas
