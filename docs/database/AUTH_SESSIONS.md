# Dicionário e ciclo de vida de `auth_sessions`

## Responsabilidade

`auth_sessions` persiste a credencial renovável corrente e os metadados mínimos
de um dispositivo vinculado a uma conta. A tabela permite localizar, expirar e
revogar uma sessão sem armazenar refresh token ou endereço IP em claro.

O `PROT-016` entregou somente model, migration, sanitização de metadata,
projeção segura e invariantes de banco. O `PROT-023` emite um `sid` UUID v7 no
access token, mas ainda não cria esta linha. Algoritmo de hash do refresh,
rotação, detecção de reuso, logout, listagem/revogação HTTP e middleware de
autenticação permanecem nos tickets `PROT-024` a `PROT-029`.

## Colunas

| Banco                | TypeScript         | Tipo PostgreSQL  | Nulo | Default   | Regra                                                          |
| -------------------- | ------------------ | ---------------- | ---- | --------- | -------------------------------------------------------------- |
| `id`                 | `id`               | `uuid`           | não  | aplicação | UUID v7 da sessão; não é gerado pelo banco.                    |
| `account_id`         | `accountId`        | `uuid`           | não  | nenhum    | Conta proprietária, protegida por FK `RESTRICT`.               |
| `refresh_token_hash` | `refreshTokenHash` | `varchar(255)`   | não  | nenhum    | Representação opaca do hash; token puro é proibido.            |
| `device_identifier`  | `deviceIdentifier` | `varchar(128)`   | não  | nenhum    | Identificador técnico opaco com caracteres restritos.          |
| `device_name`        | `deviceName`       | `varchar(120)`   | sim  | nenhum    | Nome opcional sanitizado, sem controles ou espaços nas bordas. |
| `ip_hash`            | `ipHash`           | `varchar(255)`   | sim  | nenhum    | Hash opcional do IP; o endereço bruto nunca é persistido.      |
| `user_agent`         | `userAgent`        | `varchar(512)`   | sim  | nenhum    | User-Agent opcional sanitizado e limitado.                     |
| `expires_at`         | `expiresAt`        | `timestamptz(3)` | não  | nenhum    | Expiração absoluta, obrigatoriamente posterior à criação.      |
| `last_used_at`       | `lastUsedAt`       | `timestamptz(3)` | sim  | nenhum    | Último uso válido, entre criação e expiração.                  |
| `revoked_at`         | `revokedAt`        | `timestamptz(3)` | sim  | nenhum    | Instante de revogação; `NULL` significa apenas não revogada.   |
| `created_at`         | `createdAt`        | `timestamptz(3)` | não  | `now()`   | Criação em UTC.                                                |
| `updated_at`         | `updatedAt`        | `timestamptz(3)` | não  | `now()`   | Atualizado em cada mutação.                                    |
| `version`            | `version`          | `integer`        | não  | `1`       | Controle de concorrência otimista, sempre positivo.            |

A tabela não possui `deleted_at`. Encerramento operacional é revogação;
retenção e expurgo físico dependem de política jurídica e operacional
posterior.

## Segredos e metadados

`refresh_token_hash` recebe somente o resultado codificado do algoritmo que
será aprovado no `PROT-024`. O limite e o check atuais são independentes do
algoritmo: valor vazio ou com whitespace é rejeitado. A tabela não consegue
transformar nem distinguir um token puro; a fronteira futura é obrigada a
calcular o hash antes da escrita e nunca registrar o valor recebido.

`ip_hash` segue a mesma regra de fronteira e é nullable quando não existe uma
origem confiável. Não persistir IP bruto, prefixos de rede alternativos ou
headers de proxy neste ticket. Algoritmo, chave, finalidade e retenção do hash
serão definidos antes de uso em produção.

`device_identifier` é uma chave técnica opaca, não fingerprint de hardware.
Aceita letras, números, `.`, `_`, `:`, `-`, começa por alfanumérico e possui no
máximo 128 caracteres. Não é globalmente único porque um dispositivo pode ter
mais de uma sessão conforme o fluxo futuro.

Os helpers `sanitizeAuthSessionDeviceName` e
`sanitizeAuthSessionUserAgent` removem controles, colapsam whitespace, aparam
e limitam por code point. String vazia vira `NULL`. Os checks impedem que uma
escrita fora desses helpers grave controles ou espaços de borda.

## Ciclo de vida

Não existe coluna de status. Para um instante `:now`, uma sessão é ativa
somente quando:

```sql
revoked_at IS NULL AND expires_at > :now
```

Uma conta ativa continua sendo requisito separado. A busca de autenticação
futura também deve rejeitar conta com `deleted_at`, `blocked` ou `disabled`;
uma sessão temporalmente ativa não torna a conta elegível.

Estados derivados:

| Condição                                    | Estado operacional |
| ------------------------------------------- | ------------------ |
| `revoked_at IS NULL AND expires_at > :now`  | ativa              |
| `revoked_at IS NOT NULL`                    | revogada           |
| `revoked_at IS NULL AND expires_at <= :now` | expirada           |

Uma sessão revogada permanece revogada mesmo depois de expirar. Expiração é
comparada no statement; não há job ou status que precise ser atualizado com a
passagem do tempo.

O check `auth_sessions_lifecycle_check` garante:

- `expires_at > created_at`;
- `last_used_at`, quando presente, fica entre criação inclusiva e expiração
  exclusiva;
- `revoked_at`, quando presente, não antecede a criação;
- o último uso não ocorre depois da revogação.

## Busca e revogação atômica

`auth_sessions_refresh_token_hash_uidx` torna o hash globalmente único e atende
a busca pontual. A consulta ainda aplica as condições de atividade e seleciona
somente a projeção segura:

```sql
SELECT id, device_identifier, device_name, user_agent,
       expires_at, last_used_at, revoked_at, created_at, updated_at, version
FROM auth_sessions
WHERE refresh_token_hash = :hash
  AND revoked_at IS NULL
  AND expires_at > :now;
```

`auth_sessions_account_id_revoked_at_expires_at_idx` cobre o prefixo da FK e as
consultas/listagens/revogações por conta. Não existe índice parcial com
`expires_at > now()` porque a passagem do tempo mudaria o predicado sem alterar
a linha.

Revogação individual usa um único statement condicionado pelo estado atual e
pela versão esperada:

```sql
UPDATE auth_sessions
SET revoked_at = :now,
    updated_at = :now,
    version = version + 1
WHERE id = :id
  AND revoked_at IS NULL
  AND expires_at > :now
  AND version = :expected_version;
```

Uma linha alterada significa sucesso; zero significa expirada, já revogada ou
conflito concorrente. A aplicação não repete silenciosamente nem reabre a sessão.
Revogação global e rota HTTP permanecem no `PROT-026`.

## Integridade referencial e retenção

`auth_sessions_account_id_fkey` usa `ON UPDATE NO ACTION` e
`ON DELETE RESTRICT`. O soft delete de `accounts` preserva a linha e as sessões;
hard delete da conta é impedido enquanto houver histórico. Não existe cascade
que apague credenciais ou evidência operacional silenciosamente.

O tempo de retenção de sessões expiradas/revogadas, anonimização de metadata e
procedimento de expurgo continuam pendentes de segurança, jurídico e operação.
Até essa decisão, nenhum job remove registros automaticamente.

## Projeção de saída e logging

`authSessionPublicSelection` e `serializePublicAuthSession` incluem `id`,
`deviceIdentifier`, `deviceName`, `userAgent`, `expiresAt`, `lastUsedAt`,
`revokedAt`, `createdAt`, `updatedAt` e `version`.

Ficam excluídos `accountId`, `refreshTokenHash` e `ipHash`. A projeção é uma
barreira contra exposição acidental, não um endpoint público. Identificador/nome
do dispositivo e User-Agent continuam metadata pessoal e exigem autenticação,
autorização e finalidade no consumidor futuro.

Nenhum hash, token, identificador/nome do dispositivo, User-Agent, ID de conta
ou ID de sessão entra na allowlist comum de logs. Erros PostgreSQL são tratados
por SQLSTATE e nome de constraint/índice, nunca por mensagem ou detail do
driver.

## Rotação futura

A unicidade atual impede duas sessões com o mesmo hash corrente. O `PROT-024`
definirá geração, hash, troca atômica e informação necessária para detectar
reuso de um token anterior. Se a política exigir família, predecessor ou
histórico de hashes, ela será acrescentada por migration forward; o `PROT-016`
não ativa um fluxo de refresh incompleto.

---

Documentação Protege Mais — Dicionário e ciclo de vida de sessões
