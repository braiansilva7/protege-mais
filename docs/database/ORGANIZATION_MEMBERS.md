# Dicionário e ciclo de vida de `organization_members`

## Responsabilidade

`organization_members` vincula uma conta a uma organização em contexto
organizacional ou de unidade. O vínculo registra pertencimento institucional,
não autentica a conta e não concede papel ou permissão.

O `PROT-021` entrega normalização compartilhada, model, migration, projeção
segura e integridade relacional. Cadastro HTTP, repository, atribuição de
papéis e autorização funcional permanecem nos tickets próprios.

## Colunas

| Banco                  | TypeScript           | Tipo PostgreSQL  | Nulo | Default   | Regra                                                |
| ---------------------- | -------------------- | ---------------- | ---- | --------- | ---------------------------------------------------- |
| `id`                   | `id`                 | `uuid`           | não  | aplicação | UUID v7; o banco não gera o identificador.           |
| `account_id`           | `accountId`          | `uuid`           | não  | nenhum    | Conta vinculada, com FK restritiva.                  |
| `organization_id`      | `organizationId`     | `uuid`           | não  | nenhum    | Organização do contexto, com FK restritiva.          |
| `organization_unit_id` | `organizationUnitId` | `uuid`           | sim  | nenhum    | Unidade opcional da mesma organização.               |
| `registration_number`  | `registrationNumber` | `varchar(63)`    | sim  | nenhum    | Matrícula institucional normalizada, quando existir. |
| `job_title`            | `jobTitle`           | `varchar(160)`   | sim  | nenhum    | Cargo de apresentação normalizado, quando aplicável. |
| `is_active`            | `isActive`           | `boolean`        | não  | nenhum    | Vigência explícita do vínculo.                       |
| `created_at`           | `createdAt`          | `timestamptz(3)` | não  | `now()`   | Criação em UTC.                                      |
| `updated_at`           | `updatedAt`          | `timestamptz(3)` | não  | `now()`   | Atualizado em cada mutação.                          |
| `version`              | `version`            | `integer`        | não  | `1`       | Controle de concorrência otimista, sempre positivo.  |

Conta, organização, vigência e contexto não possuem defaults de negócio.
O chamador precisa fornecer essas decisões deliberadamente.

## Contextos e duplicidade

Cada linha representa exatamente um destes contextos:

| Contexto    | `organization_id` | `organization_unit_id`    |
| ----------- | ----------------- | ------------------------- |
| Organização | UUID obrigatório  | `NULL`                    |
| Unidade     | UUID obrigatório  | UUID da mesma organização |

A constraint
`organization_members_account_organization_unit_key` usa `UNIQUE NULLS NOT
DISTINCT (account_id, organization_id, organization_unit_id)`. Portanto, o
mesmo contexto não pode ser duplicado nem quando a unidade é `NULL`. Uma conta
pode possuir vínculo organizacional e vínculos de unidades distintos na mesma
instituição, assim como participar de várias organizações.

Desativar uma linha não libera a combinação para outra linha. O retorno ao
mesmo contexto reativa o vínculo original com optimistic locking; isso evita
histórico fragmentado e concorrência entre uma linha antiga e outra nova.

## Matrícula e cargo

Matrícula e cargo são opcionais porque nem todo voluntário, colaborador ou
conta de serviço possui os dois atributos. Quando informados, recebem `trim`,
sequências de whitespace são reduzidas a um espaço e caixa/acentos são
preservados. String vazia, controle, espaço nas bordas e whitespace duplicado
são rejeitados no banco.

A matrícula não possui unicidade: formatos e escopos administrativos variam
entre instituições e unidades, e o ticket não aprovou seu uso como identidade
global. O identificador permanece disponível na leitura interna do model, mas
fica fora de `organizationMemberPublicSelection` e dos logs. Cargo também é
redigido em logs comuns.

## FKs e coerência de unidade

- `account_id` referencia `accounts.id`;
- `organization_id` referencia `organizations.id`;
- `(organization_id, organization_unit_id)` referencia
  `organization_units (organization_id, id)`.

Todas as FKs usam `ON UPDATE NO ACTION` e `ON DELETE RESTRICT`. A FK composta
rejeita uma unidade inexistente ou pertencente a outra organização. Como usa
`MATCH SIMPLE`, o contexto organizacional com unidade `NULL` continua válido.
Hard delete de conta, organização ou unidade referenciada falha e não remove o
vínculo silenciosamente.

As FKs garantem existência e coerência de ownership, não atividade. Não há
trigger cruzado para impedir uma linha ativa sob conta, organização ou unidade
inativa. A decisão de autorização futura precisa avaliar todos esses estados no
mesmo contexto.

## Vigência e concorrência

`isOrganizationMemberActive` materializa apenas o predicado local
`member.is_active`. Um vínculo inativo nunca participa da consulta operacional,
mas `is_active = true` sozinho não concede acesso. Os tickets `PROT-030` a
`PROT-032` ainda precisam conferir conta autenticada e ativa, organização,
unidade, membership, papel e permissão.

A tabela não usa soft delete. A desativação preserva a linha e a unicidade do
contexto. Mutações usam `WHERE id = :id AND version = :expected_version`,
incrementam `version` e atualizam `updated_at` no mesmo statement. Zero linhas
significa conflito concorrente; a aplicação não repete nem sobrescreve a
escrita silenciosamente.

Retenção, trilha de auditoria de alterações e eventual remoção administrativa
exigem regras futuras. A ausência de soft delete não autoriza hard delete
operacional.

## Índices, RBAC e projeção

- a unicidade contextual atende busca exata por conta, organização e unidade;
- `organization_members_account_context_active_idx` é parcial em
  `is_active` e atende a resolução dos contextos vigentes de uma conta;
- `organization_members_organization_unit_idx` atende FKs, remoções
  restritivas e consultas inversas por organização/unidade.

`organization_members` não possui `role_id`. Papéis permanecem exclusivamente
em `account_roles`, onde uma atribuição também não substitui membership. Criar,
ativar ou desativar um vínculo não cria nem remove papel automaticamente.

A projeção padrão inclui contexto, cargo, vigência, timestamps e versão, mas
omite `registration_number`. Isso reduz exposição acidental e não constitui um
endpoint público ou uma decisão de autorização.

---

Documentação Protege Mais — Dicionário de vínculos organizacionais
