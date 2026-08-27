# Convenções de tabelas e persistência

## Objetivo e alcance

Este guia é normativo para models Drizzle, migrations Atlas, repositories e
revisões de banco do Protege Mais. Ele define o padrão comum; cada ticket de
domínio ainda precisa decidir constraints, índices, nulabilidade, retenção e
efeitos de exclusão de acordo com suas regras.

O fixture em `packages/models/reference` prova estas convenções sem criar
tabelas fictícias no schema de produção. Ele não é entidade de domínio e nunca
deve ser exportado por `packages/models/index.ts`.

## Nomes e mapeamento

- tabelas usam plural em `snake_case`: `organization_units`;
- colunas usam `snake_case`: `organization_id`, `created_at`;
- propriedades e variáveis TypeScript usam `camelCase`: `organizationId`,
  `createdAt`;
- nomes são descritivos, em inglês e sem abreviações ambíguas;
- identificadores PostgreSQL devem caber no limite de 63 bytes. Quando
  necessário, reduza termos preservando tabela, colunas e finalidade; nunca
  confie no truncamento automático.

Padrão para objetos nomeados:

| Objeto               | Formato                            | Exemplo                                              |
| -------------------- | ---------------------------------- | ---------------------------------------------------- |
| primary key          | `<tabela>_pkey`                    | `accounts_pkey`                                      |
| foreign key          | `<tabela>_<colunas>_fkey`          | `auth_sessions_account_id_fkey`                      |
| unique constraint    | `<tabela>_<colunas>_key`           | `roles_code_key`                                     |
| check constraint     | `<tabela>_<regra>_check`           | `accounts_identity_check`                            |
| índice B-tree comum  | `<tabela>_<colunas>_idx`           | `auth_sessions_account_id_revoked_at_expires_at_idx` |
| índice único parcial | `<tabela>_<colunas>_<escopo>_uidx` | `accounts_email_normalized_active_uidx`              |
| índice espacial GiST | `<tabela>_<colunas>_gix`           | `organization_units_position_gix`                    |

FKs, constraints e índices devem receber nome explícito no model. A primary
key simples `id` pode usar o nome determinístico gerado pelo PostgreSQL/Atlas,
que resulta em `<tabela>_pkey`.

## Identificadores UUID v7

- IDs de entidades usam a coluna PostgreSQL `uuid`;
- o valor é UUID v7 gerado pela aplicação com `createUuidV7`;
- a coluna `id` usa `uuidV7PrimaryKey()` de `@protege-mais/models`;
- não declarar `gen_random_uuid()`, `uuid_generate_v4()` ou outro default do
  banco para IDs de entidades;
- FKs UUID não recebem default: o chamador informa a relação deliberadamente;
- API e caso de uso continuam responsáveis por validar o formato antes da
  persistência.

O `$defaultFn` do Drizzle executa somente em inserts feitos pela aplicação e não
aparece no DDL. Por isso, um insert SQL sem `id` deve falhar; scripts e
integrações também precisam gerar UUID v7 explicitamente.

## Timestamps e UTC

Instantes usam `TIMESTAMPTZ(3)`, mapeados para `Date` em TypeScript. O banco e
as sessões permanecem em UTC; o offset de apresentação pertence ao cliente.

Colunas comuns:

- `created_at`: `NOT NULL DEFAULT now()`, imutável após o insert;
- `updated_at`: `NOT NULL DEFAULT now()`, atualizado em toda mudança persistida;
- `deleted_at`: nullable, somente em tabelas que adotam soft delete.

Use `createdAtColumn()`, `updatedAtColumn()` e `deletedAtColumn()`. O
`updatedAtColumn()` oferece `$onUpdateFn` para operações Drizzle, mas SQL manual
e atualizações especiais devem definir `updated_at = now()` explicitamente. Não
existe trigger global oculta.

Uma data civil sem instante, como uma data de nascimento quando aprovada pelo
domínio, usa `date`, não meia-noite fictícia em `TIMESTAMPTZ`. Não usar
`timestamp without time zone` para instantes.

## Nulabilidade e defaults

- toda coluna obrigatória declara `.notNull()` no model e `NOT NULL` na
  migration;
- nullable significa ausência semanticamente válida, não dado ainda não
  modelado;
- string vazia, zero ou UUID sentinela não substituem `NULL`;
- defaults só existem quando há um valor correto independentemente do contexto;
- status, ownership, finalidade e consentimento não recebem defaults que
  escondam uma decisão de negócio;
- alterar `NULL` para `NOT NULL` em tabela populada exige backfill e validação
  planejados na migration.

## Enums

- conjuntos fundamentais e estáveis usam um `pgEnum` PostgreSQL por conceito;
- o nome do tipo e seus labels usam inglês em `snake_case` e respeitam o limite
  de 63 bytes;
- tuples em `@protege-mais/common` são a fonte dos values e literal union types;
  `@protege-mais/models` reutiliza essas tuples, sem copiar labels;
- labels são case-sensitive, persistentes e não são textos de interface;
- conceitos distintos não compartilham o mesmo tipo PostgreSQL apenas porque
  possuem labels iguais;
- não declare default para status ou tipo sem decisão explícita no ticket
  consumidor;
- não use a ordem do enum para prioridade, transição ou autorização.

O catálogo, a semântica e a estratégia de evolução estão em
[`ENUM_CATALOG.md`](ENUM_CATALOG.md). Adição de label usa nova migration
forward; remoção, reorder ou mudança incompatível exige tipo substituto,
mapeamento explícito e expand/contract. Nunca edite uma migration aplicada para
alterar um enum.

## Integridade, FKs e índices

Invariantes persistentes pertencem ao banco sempre que puderem ser expressas
por tipos, `NOT NULL`, `UNIQUE`, `CHECK` ou FK. Validação de aplicação melhora a
mensagem, mas não substitui a constraint sob concorrência.

Toda FK declara `ON UPDATE` e `ON DELETE` explicitamente:

- baseline: `ON UPDATE NO ACTION` e `ON DELETE RESTRICT`;
- `CASCADE` exige ownership forte e prova de que não apaga histórico exigido;
- `SET NULL` exige coluna nullable e semântica de relação opcional preservada;
- IDs são imutáveis; update cascade não é o default.

PostgreSQL não cria índice automaticamente na coluna que referencia uma FK.
Adicione-o quando consultas, deletes do pai ou joins precisarem dele, sem
duplicar um índice composto cujo prefixo já cubra o mesmo acesso.

Cada índice precisa de uma consulta ou constraint justificável. Escolha o
método adequado (`btree`, `gist`, `gin`, `brin`) e valide consultas relevantes
com `EXPLAIN` quando houver volume representativo. Índices espaciais seguem as
regras de SRID e privacidade de `docs/database/README.md`.

## Unicidade e concorrência

Unicidade de negócio deve ser garantida por constraint ou índice único. Uma
consulta anterior ao insert não evita corrida; o repository deve converter a
violação esperada da constraint em conflito determinístico sem expor valores.

Para registros mutáveis concorrentes, o baseline é optimistic locking:

- coluna `version integer NOT NULL DEFAULT 1` criada com
  `optimisticLockVersionColumn()`;
- constraint `<tabela>_version_check` exige `version > 0`;
- update usa `WHERE id = :id AND version = :expectedVersion`;
- o mesmo statement incrementa `version` e atualiza `updated_at`;
- zero linhas atualizadas significa conflito concorrente; não repetir
  silenciosamente nem sobrescrever o estado mais novo.

Exemplo conceitual:

```sql
UPDATE records
SET title = :title,
    version = version + 1,
    updated_at = now()
WHERE id = :id
  AND version = :expected_version
RETURNING id, version;
```

`updated_at` não é token de concorrência. Transições críticas, alocação de
recursos ou cálculos dependentes de múltiplas linhas podem exigir transação,
lock pessimista ou isolation level mais forte no ticket consumidor. Locks
seguem ordem determinística e timeout finito.

## Soft delete

Soft delete é opt-in e precisa de justificativa de domínio. Quando adotado:

- use `deleted_at TIMESTAMPTZ(3) NULL`;
- consultas operacionais filtram `deleted_at IS NULL` por padrão;
- consultas que incluem excluídos devem ser explícitas e autorizadas;
- restauração, quando existir, revalida unicidade, relacionamentos e permissão;
- exclusão não propaga soft delete automaticamente para filhos;
- a regra de reutilização de chaves únicas é explícita: preserve unicidade
  global ou use índice parcial `WHERE deleted_at IS NULL`;
- soft delete não define, por si só, retenção legal, anonimização ou direito de
  eliminação.

`audit_logs`, `alert_events` e `risk_assessments` nunca recebem soft delete
automático. Sua imutabilidade, correção, retenção e eventual expurgo exigem
regras próprias aprovadas nos tickets correspondentes.

## Migrations Atlas

- Drizzle é o estado tipado desejado; Atlas é o histórico estrutural aplicado;
- migrations de produção ficam em `atlas/prod` e nunca dependem de seed;
- arquivos usam `<timestamp_UTC>_<descricao_snake_case>.sql`;
- cada arquivo entrega uma mudança lógica pequena e revisável;
- não editar migration aplicada ou compartilhada; correção usa nova migration;
- `atlas migrate apply` verifica checksum e nunca executa `hash`;
- rollback em ambientes persistentes usa migration compensatória revisada;
- mudança destrutiva usa expand/backfill/contract, com compatibilidade entre
  versões da aplicação e plano de recuperação;
- operações longas ou bloqueantes precisam de estratégia explícita. Uso de
  `CONCURRENTLY`, transaction mode especial ou validação posterior de
  constraint pertence ao ticket e deve aparecer no SQL revisado;
- migrations não contêm credenciais, PII, coordenadas reais ou dados de
  produção.

O checklist obrigatório está em
[`MIGRATION_CHECKLIST.md`](MIGRATION_CHECKLIST.md).

## Referência executável

O fixture cobre duas tabelas descartáveis:

- `convention_owners`: UUID v7 da aplicação, timestamps, version e unique
  constraint;
- `convention_records`: FK nomeada, propriedade camelCase mapeada, coluna
  nullable, optimistic lock, soft delete, índice de FK e unicidade ativa
  parcial.

Comandos:

```bash
pnpm model:reference:export
pnpm model:reference:validate
pnpm model:reference:diff
pnpm --filter @protege-mais/models test
```

`diff` deve responder que o diretório está sincronizado. O ambiente Atlas
`reference` usa somente o banco descartável de desenvolvimento e a migration em
`packages/models/reference/atlas`; ele não possui URL de deploy.

---

Documentação Protege Mais — Convenções de banco
