# Catálogo de enums fundamentais

## Objetivo e fonte de verdade

Este catálogo define os valores internos iniciais usados pelos models de
identidade, organização, proteção, emergência, evidência e notificação. Ele
mantém PostgreSQL e TypeScript equivalentes; `accounts` consome os tipos de
conta e `organizations` consome `organization_type`, enquanto as demais
entidades permanecem futuras.

As tuples em `packages/common/enums/index.ts` são a fonte dos valores e dos
literal union types TypeScript. Os `pgEnum` em `packages/models/enums.ts`
reutilizam as mesmas tuples e definem os nomes PostgreSQL. A migration Atlas é
o histórico aplicado. Alterar somente um desses pontos é divergência.

Os labels são contratos internos estáveis em inglês e `snake_case`. Interfaces
traduzem sua apresentação; não exibem o label bruto como texto final. Nenhum
enum define permissão, default, transição automática ou conclusão jurídica.

## Identidade e organização

### `account_status` / `AccountStatus`

| Valor      | Semântica inicial                                                   |
| ---------- | ------------------------------------------------------------------- |
| `active`   | Conta elegível nesta dimensão; as demais regras ainda se aplicam.   |
| `blocked`  | Conta impedida por uma restrição de segurança ou elegibilidade.     |
| `disabled` | Conta desativada administrativamente, sem implicar exclusão física. |

O motivo, a autoria e as transições pertencem aos tickets de conta e
autenticação. `active` não concede papel, organização ou permissão.
`accounts.status` é obrigatório e não possui default, portanto cada caso de uso
futuro precisa declarar o estado inicial deliberadamente.

### `account_type` / `AccountType`

| Valor     | Semântica inicial                                                     |
| --------- | --------------------------------------------------------------------- |
| `person`  | Identidade operada por uma pessoa natural.                            |
| `service` | Identidade técnica não humana, sem fluxo de credencial definido aqui. |

O tipo não substitui perfil de vítima, membership, papel ou autorização.
`accounts.type` é obrigatório e não possui default. O model aceita a distinção
estrutural, mas ainda não existe fluxo que cadastre ou autentique contas.

### `organization_type` / `OrganizationType`

| Valor                  | Semântica inicial                                 |
| ---------------------- | ------------------------------------------------- |
| `public_agency`        | Órgão ou entidade do setor público.               |
| `nonprofit`            | Organização sem finalidade lucrativa.             |
| `private_organization` | Organização privada não classificada como ONG.    |
| `other`                | Categoria institucional fora do conjunto inicial. |

A classificação não concede integração, escopo ou permissão e não substitui
validação cadastral ou jurídica.
`organizations.type` é obrigatório e não possui default; o chamador futuro deve
escolher deliberadamente um dos quatro valores.

## Proteção e risco

### `case_status` / `CaseStatus`

| Valor    | Semântica inicial                                              |
| -------- | -------------------------------------------------------------- |
| `open`   | Caso em acompanhamento operacional.                            |
| `closed` | Caso encerrado no fluxo operacional, com histórico preservado. |

A máquina de estados, reabertura, transferência e mutações permitidas serão
definidas no `PROT-039`.

### `risk_level` / `RiskLevel`

| Valor      | Semântica inicial               |
| ---------- | ------------------------------- |
| `low`      | Classificação de risco baixa.   |
| `medium`   | Classificação de risco média.   |
| `high`     | Classificação de risco alta.    |
| `critical` | Classificação de risco crítica. |

Ausência de avaliação deve ser modelada por nulabilidade ou estado próprio do
recurso consumidor, não por um nível fictício. Método de cálculo, resposta
operacional e revisão exigem regras posteriores.

### `incident_type` / `IncidentType`

| Valor                     | Semântica operacional inicial                     |
| ------------------------- | ------------------------------------------------- |
| `physical_violence`       | Registro classificado como violência física.      |
| `psychological_violence`  | Registro classificado como violência psicológica. |
| `sexual_violence`         | Registro classificado como violência sexual.      |
| `property_violence`       | Registro classificado como violência patrimonial. |
| `moral_violence`          | Registro classificado como violência moral.       |
| `protective_order_breach` | Possível descumprimento de medida protetiva.      |
| `other`                   | Categoria fora do conjunto operacional inicial.   |

Esses valores organizam o registro; não afirmam culpa, condenação ou
enquadramento jurídico definitivo. Correção e trilha histórica pertencem ao
`PROT-042`.

### `incident_severity` / `IncidentSeverity`

| Valor      | Semântica inicial               |
| ---------- | ------------------------------- |
| `low`      | Severidade operacional baixa.   |
| `medium`   | Severidade operacional média.   |
| `high`     | Severidade operacional alta.    |
| `critical` | Severidade operacional crítica. |

Severidade de incidente e nível de risco são tipos PostgreSQL distintos,
mesmo quando compartilham labels. Não podem ser comparados ou convertidos
implicitamente.

## Termos de medida protetiva

### `protective_order_term_status` / `ProtectiveOrderTermStatus`

| Valor       | Semântica inicial                          |
| ----------- | ------------------------------------------ |
| `active`    | Termo vigente no estado operacional.       |
| `suspended` | Efeito do termo temporariamente suspenso.  |
| `revoked`   | Termo revogado, com histórico preservado.  |
| `expired`   | Vigência do termo encerrada por expiração. |

Este status não é alterado automaticamente por relógio nesta etapa. Datas,
transições e autoridade da mudança pertencem ao `PROT-044`.

### `protective_order_term_type` / `ProtectiveOrderTermType`

| Valor                | Semântica estrutural inicial                         |
| -------------------- | ---------------------------------------------------- |
| `no_contact`         | Proibição de contato pelos meios definidos no termo. |
| `minimum_distance`   | Distância mínima parametrizada.                      |
| `place_restriction`  | Restrição de acesso a local parametrizado.           |
| `weapon_restriction` | Restrição relacionada a arma.                        |
| `other`              | Tipo fora do conjunto estruturado inicial.           |

Os parâmetros válidos, a apresentação e a validação discriminada não são
definidos por este enum; pertencem ao ticket da tabela consumidora.

## Emergência

### `emergency_alert_status` / `EmergencyAlertStatus`

| Valor          | Semântica inicial                                  |
| -------------- | -------------------------------------------------- |
| `received`     | Alerta duravelmente recebido pelo sistema.         |
| `acknowledged` | Alerta assumido para tratamento autorizado.        |
| `dispatched`   | Atendimento ou acionamento operacional despachado. |
| `resolved`     | Tratamento operacional marcado como resolvido.     |

Esses labels não implementam a máquina de estados nem garantem SLO. Transições,
idempotência, atores e eventos serão definidos no `PROT-046` e no `PROT-048`.

### `alert_trigger_type` / `AlertTriggerType`

| Valor                  | Semântica inicial                                 |
| ---------------------- | ------------------------------------------------- |
| `manual`               | Gatilho iniciado por ação deliberada do usuário.  |
| `automatic`            | Gatilho iniciado por regra automatizada aprovada. |
| `external_integration` | Gatilho recebido de integração externa aprovada.  |

Os valores `automatic` e `external_integration` não ativam essas capacidades.
Cada origem exige contrato, autenticação, idempotência e revisão de segurança
em ticket próprio.

## Evidência e notificação

### `evidence_type` / `EvidenceType`

| Valor      | Semântica inicial                           |
| ---------- | ------------------------------------------- |
| `image`    | Conteúdo visual estático.                   |
| `video`    | Conteúdo audiovisual.                       |
| `audio`    | Conteúdo sonoro.                            |
| `document` | Documento digital aceito pelo fluxo futuro. |
| `other`    | Tipo fora do conjunto inicial.              |

O enum não substitui MIME type, extensão, tamanho, hash, malware scanning,
autorização ou cadeia de custódia.

### `notification_channel` / `NotificationChannel`

| Valor   | Semântica inicial   |
| ------- | ------------------- |
| `push`  | Notificação push.   |
| `sms`   | Mensagem SMS.       |
| `email` | Mensagem de e-mail. |

Um canal listado não está automaticamente habilitado. Consentimento,
verificação do destino, provider e finalidade pertencem ao fluxo consumidor.

### `notification_status` / `NotificationStatus`

| Valor        | Semântica inicial                                       |
| ------------ | ------------------------------------------------------- |
| `pending`    | Entrega registrada e ainda não iniciada.                |
| `processing` | Tentativa de entrega em processamento.                  |
| `sent`       | Conteúdo aceito pelo provider ou transporte.            |
| `delivered`  | Entrega confirmada quando o canal oferecer confirmação. |
| `failed`     | Entrega encerrada como falha pela política futura.      |

Retry, backoff, terminalidade e transições não são inferidos deste enum.

## Regras de uso

- tabelas consumidoras usam o `pgEnum` correspondente de
  `@protege-mais/models` e não recriam arrays locais;
- casos de uso, contratos e workers importam values/types de
  `@protege-mais/common`;
- nenhum status ou tipo recebe default sem decisão explícita do ticket da
  entidade;
- valide entrada na fronteira da aplicação e preserve o enum PostgreSQL como
  garantia final contra valor inválido;
- não use a ordem declarada do PostgreSQL para prioridade, autorização ou
  transição. Ordenação de negócio deve ser explícita;
- tipos diferentes não são intercambiáveis, mesmo quando possuem os mesmos
  labels.

## Estratégia de evolução

1. Atualize a tuple em `packages/common`, reutilize-a no `pgEnum` e gere um
   novo diff Atlas; nunca edite migration aplicada.
2. Adicionar um label exige migration forward com `ALTER TYPE ... ADD VALUE`.
   Prefira anexar ao final, pois ordem não tem semântica de negócio.
3. A migration entra antes da versão da aplicação que grava o novo label. Se o
   label for adicionado dentro de uma transação, ele só pode ser usado depois do
   commit.
4. Renomear muda contrato de banco, eventos e APIs; exige compatibilidade e
   revisão de todos os consumidores.
5. PostgreSQL não remove labels nem reordena enums diretamente. Remoção ou
   mudança incompatível exige novo tipo, mapeamento explícito dos dados,
   conversão das colunas e estratégia expand/contract em migration revisada.
6. Toda evolução executa testes de paridade TypeScript/Drizzle/PostgreSQL,
   inserção válida e rejeição de valor inválido, além do checklist de migration.

---

Documentação Protege Mais — Catálogo de enums fundamentais
