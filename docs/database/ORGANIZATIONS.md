# Dicionário e ciclo de vida de `organizations`

## Responsabilidade

`organizations` representa a instituição participante e cria a identidade
estável que será usada por unidades, vínculos e autorização contextual. A
tabela não representa unidade operacional, conta, papel ou permissão.

O `PROT-019` entrega somente normalização compartilhada, model, migration,
projeção segura e invariantes de banco. Cadastro HTTP, repository, integração
externa e autorização funcional permanecem em seus tickets.

## Colunas

| Banco                   | TypeScript            | Tipo PostgreSQL     | Nulo | Default   | Regra                                                 |
| ----------------------- | --------------------- | ------------------- | ---- | --------- | ----------------------------------------------------- |
| `id`                    | `id`                  | `uuid`              | não  | aplicação | UUID v7; o banco não gera o identificador.            |
| `name`                  | `name`                | `varchar(160)`      | não  | nenhum    | Nome de apresentação com espaçamento normalizado.     |
| `name_normalized`       | `nameNormalized`      | `varchar(160)`      | não  | nenhum    | Chave em minúsculas para busca pelo nome.             |
| `legal_name`            | `legalName`           | `varchar(255)`      | não  | nenhum    | Razão social com espaçamento normalizado.             |
| `legal_name_normalized` | `legalNameNormalized` | `varchar(255)`      | não  | nenhum    | Chave em minúsculas para busca pela razão social.     |
| `type`                  | `type`                | `organization_type` | não  | nenhum    | Tipo fundamental, escolhido explicitamente.           |
| `cnpj`                  | `cnpj`                | `varchar(14)`       | não  | nenhum    | Identificador canônico, numérico ou alfanumérico.     |
| `state_code`            | `stateCode`           | `varchar(2)`        | não  | nenhum    | Uma das 27 siglas de UF em maiúsculas.                |
| `municipality_code`     | `municipalityCode`    | `varchar(7)`        | não  | nenhum    | Código IBGE de sete dígitos coerente com a UF.        |
| `is_active`             | `isActive`            | `boolean`           | não  | nenhum    | Elegibilidade institucional explícita.                |
| `integration_enabled`   | `integrationEnabled`  | `boolean`           | não  | nenhum    | Configuração explícita; não ativa integração sozinha. |
| `created_at`            | `createdAt`           | `timestamptz(3)`    | não  | `now()`   | Criação em UTC.                                       |
| `updated_at`            | `updatedAt`           | `timestamptz(3)`    | não  | `now()`   | Atualizado em cada mutação.                           |
| `version`               | `version`             | `integer`           | não  | `1`       | Controle de concorrência otimista, sempre positivo.   |
| `deleted_at`            | `deletedAt`           | `timestamptz(3)`    | sim  | nenhum    | Soft delete; `NULL` identifica registro não excluído. |

Tipo, estado ativo e habilitação de integração não possuem default de
negócio. O chamador futuro deve fornecer cada decisão deliberadamente.

## Normalização de nomes

`normalizeOrganizationName` apara as bordas e reduz sequências de whitespace
a um espaço, preservando caixa e acentos para apresentação.
`normalizeOrganizationSearchText` aplica a mesma regra e converte a chave para
minúsculas. Nome e razão social armazenados não aceitam controles, bordas com
espaço nem whitespace duplicado; as colunas normalizadas precisam corresponder
ao `lower` do valor de apresentação.

As normalizações são idempotentes. Busca futura normaliza a entrada antes da
consulta e nunca usa uma chave enviada pelo cliente como valor confiável.

## CNPJ numérico e alfanumérico

O valor persistido não contém máscara, possui exatamente 14 caracteres e usa
maiúsculas. As 12 primeiras posições aceitam `0-9` e `A-Z`; as duas últimas
são dígitos verificadores numéricos. O valor sentinela todo-zero é rejeitado. O
banco e `isValidOrganizationCnpj` conferem o módulo 11 baseado em `ASCII - 48`.
`normalizeOrganizationCnpj` remove pontos, barra, hífen e whitespace e converte
letras para maiúsculas; não remove caracteres desconhecidos para evitar que uma
entrada inválida se transforme silenciosamente em outra identidade.

Os formatos numérico legado e alfanumérico coexistem. A Receita Federal iniciou
a emissão alfanumérica em julho de 2026 e manteve os identificadores anteriores
válidos. A referência normativa e a decisão de persistência estão no
[ADR-006](../decisions/ADR-006-organization-identity-and-lifecycle.md).

`organizations_cnpj_key` preserva unicidade global, inclusive para registros
excluídos. Soft delete não libera o identificador para outra linha: recriar o
mesmo CNPJ fragmentaria unidades, vínculos e histórico da mesma instituição. A
recuperação futura deve restaurar a linha original com optimistic locking.

## UF e município

`normalizeOrganizationStateCode` apara e converte a UF para maiúsculas.
`brazilianStateCodes` e o check do banco aceitam exatamente as 27 siglas.
`municipality_code` preserva zeros à esquerda, aceita sete dígitos e precisa
começar pelo prefixo IBGE correspondente à UF. O schema não tenta substituir o
catálogo oficial completo de municípios; existência e vigência do código ainda
devem ser validadas pela fronteira aprovada quando houver cadastro funcional.

## Ativação, integração e soft delete

Uma organização é operacional somente quando:

```sql
is_active AND deleted_at IS NULL
```

`isOrganizationOperational` materializa o mesmo predicado no TypeScript.
`integration_enabled` registra somente que a configuração institucional permite
a integração futura; não torna uma organização inativa ou excluída operacional
e não ativa qualquer adaptador neste ticket.

O soft delete preserva a identidade e as referências. Consultas operacionais
sempre filtram os dois campos. Consultas administrativas de inativos ou
excluídos devem ser explícitas e autorizadas. Retenção, restauração HTTP,
anonimização e hard delete permanecem pendentes de regras próprias.

## Índices e concorrência

- `organizations_cnpj_key` atende busca e conflito pelo identificador global;
- `organizations_name_normalized_active_idx` atende busca operacional por nome;
- `organizations_legal_name_normalized_active_idx` atende busca operacional por
  razão social;
- `organizations_state_municipality_active_idx` atende listagem operacional por
  UF/município e ordena por nome normalizado.

Os três índices de pesquisa são parciais com `deleted_at IS NULL AND
is_active`. Consultas que não repetirem esse predicado não devem esperar o mesmo
plano.

Mutações usam `WHERE id = :id AND version = :expected_version`, incrementam
`version` e atualizam `updated_at` no mesmo statement. Zero linhas significa
conflito concorrente; nenhuma escrita é repetida silenciosamente.

## RBAC, projeção e segurança

`account_roles.organization_id` agora referencia `organizations.id` com
`ON UPDATE NO ACTION` e `ON DELETE RESTRICT`. A FK impede contextos para uma
organização inexistente e impede hard delete enquanto houver atribuição. Ela
não substitui a verificação futura de organização operacional e membership.
Desde o `PROT-020`, o par com `organization_unit_id` possui FK composta para
impedir que uma atribuição combine a organização com unidade de outra
instituição.

CNPJ é um identificador cadastral público, mas não pertence à allowlist de
logs nem deve aparecer em listas ou erros por conveniência. A projeção padrão
`organizationPublicSelection` omite CNPJ, razão social, chaves normalizadas e
`deleted_at`. Isso é uma barreira contra exposição acidental, não um endpoint ou
uma decisão de acesso.

---

Documentação Protege Mais — Dicionário e ciclo de vida de organizações
