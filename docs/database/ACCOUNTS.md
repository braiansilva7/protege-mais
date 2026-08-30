# Dicionário de dados de `accounts`

## Responsabilidade

`accounts` persiste identidades de acesso. Uma conta não é um perfil de
vítima, profissional, membro de organização, papel ou permissão. Essas relações
pertencem aos tickets consumidores.

O `PROT-015` cria somente o model, a migration, a normalização compartilhada e
uma projeção de saída que exclui segredos. Não existem rota de cadastro ou
login, repositório, algoritmo de senha, integração com provider, fator MFA ou
autorização neste estágio.

## Colunas

| Banco               | TypeScript         | Tipo PostgreSQL  | Nulo | Default   | Regra                                                                   |
| ------------------- | ------------------ | ---------------- | ---- | --------- | ----------------------------------------------------------------------- |
| `id`                | `id`               | `uuid`           | não  | aplicação | Chave UUID v7; o banco não gera o identificador.                        |
| `email`             | `email`            | `varchar(320)`   | sim  | nenhum    | Forma original já aparada, preservada para apresentação.                |
| `email_normalized`  | `emailNormalized`  | `varchar(320)`   | sim  | nenhum    | Chave canônica `trim + lowercase`; acompanha a nulabilidade de `email`. |
| `phone_e164`        | `phoneE164`        | `varchar(16)`    | sim  | nenhum    | `+` seguido por até 15 dígitos, sem formatação local.                   |
| `password_hash`     | `passwordHash`     | `text`           | sim  | nenhum    | Hash opaco não vazio; nunca faz parte de projeção de saída.             |
| `external_provider` | `externalProvider` | `varchar(63)`    | sim  | nenhum    | Slug minúsculo do provider, como `oidc_example`.                        |
| `external_subject`  | `externalSubject`  | `varchar(255)`   | sim  | nenhum    | Identificador opaco do principal no provider.                           |
| `type`              | `type`             | `account_type`   | não  | nenhum    | `person` ou `service`; sempre escolhido pelo caso de uso.               |
| `status`            | `status`           | `account_status` | não  | nenhum    | `active`, `blocked` ou `disabled`; não define autorização.              |
| `mfa_enabled`       | `mfaEnabled`       | `boolean`        | não  | nenhum    | Indicador explícito; não armazena segredo nem comprova um fator.        |
| `last_login_at`     | `lastLoginAt`      | `timestamptz(3)` | sim  | nenhum    | Último login confirmado; `NULL` antes do primeiro login.                |
| `created_at`        | `createdAt`        | `timestamptz(3)` | não  | `now()`   | Instante de criação em UTC.                                             |
| `updated_at`        | `updatedAt`        | `timestamptz(3)` | não  | `now()`   | Atualizado pela escrita da aplicação.                                   |
| `version`           | `version`          | `integer`        | não  | `1`       | Controle de concorrência otimista; deve permanecer maior que zero.      |
| `deleted_at`        | `deletedAt`        | `timestamptz(3)` | sim  | nenhum    | Soft delete opt-in; `NULL` identifica uma conta ativa para unicidade.   |

`external_subject` complementa o provider porque o nome do provider, sozinho,
não identifica um principal externo nem permite unicidade determinística.

## Métodos de identidade

Uma linha é válida quando possui pelo menos um dos pares completos:

- identidade local: `email_normalized` e `password_hash`;
- identidade externa: `external_provider` e `external_subject`.

Os dois métodos podem coexistir na mesma conta. Provider e subject são ambos
nulos ou ambos preenchidos. Telefone é um identificador de contato único, mas
não constitui sozinho um método de autenticação neste ticket.

O helper `normalizeAccountEmail` recebe a entrada da fronteira e produz
`email.trim().toLowerCase()`. A forma armazenada em `email` também deve estar
sem espaços nas bordas. O check do banco confirma a correspondência e uma forma
mínima sem espaços e com um único `@`; validação completa, confirmação de posse e
políticas de endereço pertencem aos fluxos posteriores.

`phone_e164` aceita somente `^\\+[1-9][0-9]{1,14}$`. A aplicação deve converter
uma entrada local para E.164 antes de persistir; a tabela não infere país nem
remove formatação.

## Integridade e conflitos

| Objeto                                                    | Garantia                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `accounts_email_normalization_check`                      | E-mail original e normalizado são nulos juntos ou coerentes. |
| `accounts_phone_e164_check`                               | Telefone opcional está na representação E.164 adotada.       |
| `accounts_password_hash_check`                            | Hash opcional nunca é vazio.                                 |
| `accounts_external_identity_check`                        | Provider/subject formam um par completo e o provider é slug. |
| `accounts_identity_method_check`                          | Existe identidade local ou externa completa.                 |
| `accounts_version_check`                                  | A versão permanece positiva.                                 |
| `accounts_email_normalized_active_uidx`                   | E-mail normalizado é único entre contas não excluídas.       |
| `accounts_phone_e164_active_uidx`                         | Telefone é único entre contas não excluídas.                 |
| `accounts_external_provider_external_subject_active_uidx` | O principal externo é único entre contas não excluídas.      |

As três garantias de unicidade são índices parciais com
`deleted_at IS NULL`. Uma violação retorna SQLSTATE `23505` e o nome estável do
índice. A camada de aplicação futura deve mapear somente esses metadados para
um conflito de domínio; mensagem, detail e hint do driver não podem chegar ao
cliente ou aos logs porque podem conter o identificador pessoal.

## Soft delete e reutilização

E-mail, telefone e principal externo podem ser reutilizados depois que a conta
anterior recebe `deleted_at`. A conta antiga e seu UUID permanecem preservados
para referências históricas. Restaurá-la não é automático: se outra conta tiver
reivindicado algum identificador, o mesmo índice parcial rejeita a restauração.

Toda busca operacional por identidade ativa deve incluir
`deleted_at IS NULL`. A justificativa, as alternativas e as consequências
estão no
[ADR-004](../decisions/ADR-004-active-account-identifier-reuse.md).

## Projeção de saída e segurança

`accountPublicSelection` e `serializePublicAccount` incluem somente `id`,
`email`, `phoneE164`, `externalProvider`, `type`, `status`, `mfaEnabled`,
`lastLoginAt`, `createdAt`, `updatedAt` e `version`.

Ficam excluídos `passwordHash`, `emailNormalized`, `externalSubject` e
`deletedAt`. A projeção evita vazamento de segredo e chaves internas, mas não
cria um endpoint público: e-mail e telefone continuam dados pessoais e qualquer
consumidor futuro precisa de autenticação, autorização e minimização adequadas.

Hash, e-mail, telefone e subject externo não entram em logs. O algoritmo de
hash, criação e troca de senha, verificação de e-mail/telefone, MFA, hard delete,
retenção e anonimização permanecem fora do `PROT-015`.

`auth_sessions` referencia `accounts` com `ON DELETE RESTRICT`: o soft delete
preserva a conta e o histórico, enquanto hard delete é impedido se houver sessão.
O ciclo de vida está em [AUTH_SESSIONS.md](AUTH_SESSIONS.md).

`organization_members` também referencia a conta com exclusão restrita. O
vínculo registra pertencimento a uma organização/unidade sem transformar a
conta em perfil profissional nem conceder papel. Seu contrato está em
[ORGANIZATION_MEMBERS.md](ORGANIZATION_MEMBERS.md).

---

Documentação Protege Mais — Dicionário de dados de contas
