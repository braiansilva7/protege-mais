# Dicionário e ciclo de vida de `organization_units`

## Responsabilidade

`organization_units` representa um endereço operacional pertencente a uma
única organização. A tabela materializa identidade contextual, contato,
endereço brasileiro estruturado e posição geográfica para consultas de
proximidade. Ela não representa membership, conta, papel, permissão ou
autorização funcional.

O `PROT-020` entrega normalização compartilhada, model, migration, projeção
segura, integridade espacial e a FK contextual do RBAC. Cadastro HTTP,
repository, catálogo funcional de tipos e validação de vínculo permanecem em
tickets próprios.

## Colunas

| Banco                | TypeScript          | Tipo PostgreSQL         | Nulo | Default   | Regra                                                     |
| -------------------- | ------------------- | ----------------------- | ---- | --------- | --------------------------------------------------------- |
| `id`                 | `id`                | `uuid`                  | não  | aplicação | UUID v7; o banco não gera o identificador.                |
| `organization_id`    | `organizationId`    | `uuid`                  | não  | nenhum    | Organização proprietária, com FK restritiva.              |
| `name`               | `name`              | `varchar(160)`          | não  | nenhum    | Apresentação com espaçamento normalizado.                 |
| `name_normalized`    | `nameNormalized`    | `varchar(160)`          | não  | nenhum    | Chave em minúsculas para pesquisa.                        |
| `code`               | `code`              | `varchar(63)`           | não  | nenhum    | Código técnico canônico e único na organização.           |
| `type`               | `type`              | `varchar(63)`           | não  | nenhum    | Código técnico em `snake_case`, sem catálogo fechado.     |
| `contact_email`      | `contactEmail`      | `varchar(320)`          | sim  | nenhum    | E-mail canônico em minúsculas.                            |
| `contact_phone_e164` | `contactPhoneE164`  | `varchar(16)`           | sim  | nenhum    | Telefone E.164 iniciado por `+`.                          |
| `address_street`     | `addressStreet`     | `varchar(255)`          | não  | nenhum    | Logradouro normalizado.                                   |
| `address_number`     | `addressNumber`     | `varchar(31)`           | não  | nenhum    | Número ou designação textual, como `s/n`.                 |
| `address_complement` | `addressComplement` | `varchar(160)`          | sim  | nenhum    | Complemento normalizado quando informado.                 |
| `address_district`   | `addressDistrict`   | `varchar(160)`          | não  | nenhum    | Bairro ou distrito normalizado.                           |
| `postal_code`        | `postalCode`        | `varchar(8)`            | não  | nenhum    | CEP canônico com oito dígitos.                            |
| `state_code`         | `stateCode`         | `varchar(2)`            | não  | nenhum    | Uma das 27 siglas de UF em maiúsculas.                    |
| `municipality_code`  | `municipalityCode`  | `varchar(7)`            | não  | nenhum    | Código IBGE coerente com a UF.                            |
| `longitude`          | `longitude`         | `double precision`      | não  | nenhum    | Valor finito entre -180 e 180.                            |
| `latitude`           | `latitude`          | `double precision`      | não  | nenhum    | Valor finito entre -90 e 90.                              |
| `position`           | `position`          | `geography(Point,4326)` | não  | gerado    | Ponto derivado de longitude/latitude; não aceita escrita. |
| `is_active`          | `isActive`          | `boolean`               | não  | nenhum    | Elegibilidade operacional explícita da unidade.           |
| `created_at`         | `createdAt`         | `timestamptz(3)`        | não  | `now()`   | Criação em UTC.                                           |
| `updated_at`         | `updatedAt`         | `timestamptz(3)`        | não  | `now()`   | Atualizado em cada mutação.                               |
| `version`            | `version`           | `integer`               | não  | `1`       | Controle de concorrência otimista, sempre positivo.       |
| `deleted_at`         | `deletedAt`         | `timestamptz(3)`        | sim  | nenhum    | Soft delete; `NULL` identifica registro não excluído.     |

Ownership, tipo e estado ativo não possuem default de negócio. O chamador
precisa informar cada decisão deliberadamente.

## Identidade contextual e ownership

`normalizeOrganizationUnitCode` apara e converte o código para maiúsculas. O
valor persistido começa por letra ou dígito e aceita somente `A-Z`, `0-9`, `.`,
`_` e `-`, até 63 posições. `UNIQUE (organization_id, code)` arbitra conflitos
sob concorrência e preserva a reserva do código mesmo depois do soft delete.
Restauração reutiliza a linha original; uma segunda identidade com o mesmo
código dentro da organização não é criada.

`organization_id` é obrigatório e usa `ON UPDATE NO ACTION` e `ON DELETE
RESTRICT`. Uma linha pertence a exatamente uma organização. A aplicação trata
ownership como imutável; transferência futura exige caso de uso, análise das
atribuições e decisão própria. `UNIQUE (organization_id, id)` existe para ser o
alvo da FK composta do RBAC e comprovar no banco que o par de contexto é
coerente.

`type` não usa `pgEnum`: o ticket não aprovou uma taxonomia de unidade. Ele é um
código técnico obrigatório, canônico em minúsculas e `snake_case`. Um catálogo
fechado só pode ser criado quando seus valores e evolução forem definidos pelo
domínio.

## Contatos e endereço estruturado

E-mail e telefone são opcionais e independentes. E-mail usa `trim`, minúsculas e
formato mínimo sem whitespace; telefone aceita somente E.164. Ausência usa
`NULL`, nunca string vazia.

Logradouro, número, bairro, CEP, UF e município são obrigatórios; complemento é
o único componente opcional. Partes textuais removem whitespace nas bordas,
reduzem sequências internas a um espaço e rejeitam controles ou duplicidade de
whitespace no banco. O CEP persistido contém exatamente oito dígitos. UF e
município reutilizam as regras de `organizations`: sigla válida, código IBGE de
sete dígitos e prefixo estadual coerente. A existência e vigência completas do
CEP e do município ainda pertencem à fronteira de cadastro futura.

Endereço é dado pessoal/operacional protegido. Componentes não entram em logs,
erros comuns nem na projeção padrão.

## Posição e consulta espacial

A entrada sempre respeita a ordem longitude, latitude. Os dois escalares são a
fonte de escrita e recebem checks de faixa antes da geração do ponto. Isso é
necessário porque o cast direto de texto para `geography` pode normalizar
silenciosamente coordenadas fora da faixa em vez de rejeitá-las.

`position` é uma coluna armazenada gerada sempre por:

```sql
ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
```

Ela não pode ser enviada em `INSERT` ou `UPDATE`, evitando duas fontes de
verdade. `geography(Point,4326)` fixa tipo e SRID, mantém longitude como primeiro
eixo e faz `ST_Distance` retornar metros. O índice
`organization_units_position_gix` usa GiST e atende `ST_DWithin`; consultas de
proximidade ainda precisam aplicar os filtros de atividade e autorização
adequados ao caso de uso.

Coordenadas, posição e distância ligada a um local protegido nunca aparecem em
logs comuns. `organizationUnitPublicSelection` omite todos os componentes de
contato, endereço e localização.

## Operacionalidade, soft delete e concorrência

Uma unidade é operacional somente quando a unidade e sua organização estão
ativas e não excluídas:

```sql
unit.is_active
AND unit.deleted_at IS NULL
AND organization.is_active
AND organization.deleted_at IS NULL
```

`isOrganizationUnitOperational` materializa o mesmo predicado no TypeScript.
Uma FK garante existência, não atividade; não há trigger cruzado para copiar o
estado do pai. Consultas operacionais precisam fazer o join e repetir todo o
predicado.

Mutações usam `WHERE id = :id AND version = :expected_version`, incrementam
`version` e atualizam `updated_at` no mesmo statement. Soft delete preserva
identidade, código, ownership e referências. Retenção, restauração HTTP,
anonimização e hard delete exigem regras próprias.

## Índices e RBAC

- `organization_units_organization_id_code_key` garante código contextual e
  também atende o prefixo da FK da organização;
- `organization_units_organization_id_id_key` sustenta a referência composta;
- `organization_units_organization_name_active_idx` atende listagem ativa por
  organização e nome normalizado;
- `organization_units_position_gix` atende busca espacial por proximidade;
- `account_roles_organization_unit_id_idx` atende o caminho inverso e remoções
  restritivas da unidade.
- `organization_members_organization_unit_idx` atende vínculos por
  organização/unidade e remoções restritivas.

`account_roles` referencia `(organization_id, organization_unit_id)` em
`organization_units (organization_id, id)`. Assim, unidade inexistente e par
organização/unidade divergente falham no banco. A FK é `MATCH SIMPLE`: quando a
unidade é `NULL`, o contexto organizacional continua válido; o check existente
impede unidade sem organização. Isso ainda não concede acesso nem valida
membership, papel ativo ou finalidade.

`organization_members` reutiliza a mesma referência composta para impedir um
vínculo com unidade de outra organização. Unidade nula representa membership
organizacional; unidade preenchida limita a linha àquele contexto. O contrato
completo está em [ORGANIZATION_MEMBERS.md](ORGANIZATION_MEMBERS.md).

---

Documentação Protege Mais — Dicionário e ciclo de vida de unidades
