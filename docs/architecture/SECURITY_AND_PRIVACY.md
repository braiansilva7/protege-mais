# Segurança e privacidade

## Objetivo

Definir os requisitos mínimos para um sistema que trata violência, emergência,
localização e evidências. Este documento é normativo para todos os tickets.

## Classificação inicial dos dados

| Classe                    | Exemplos                         | Regra mínima                                                          |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| Segredo de autenticação   | senha, token, chave, código MFA  | Nunca logar; hash ou armazenamento seguro conforme o uso              |
| Identificador pessoal     | CPF, telefone, e-mail, endereço  | Minimizar, restringir, mascarar e proteger em repouso quando definido |
| Dado sensível de proteção | relato, risco, medida, evidência | Menor privilégio, auditoria e escopo contextual                       |
| Geolocalização            | ponto, sessão e local protegido  | Acesso excepcional, retenção definida e nunca registrar em log comum  |
| Metadado operacional      | requestId, status, duração       | Permitido se não permitir reconstruir conteúdo sensível               |

## Dados proibidos em logs

- senha, hash reutilizável, access token ou refresh token;
- CPF, endereço, matrícula, cargo e dados médicos;
- relatos da vítima e conteúdo de ocorrência;
- coordenadas ou locais protegidos;
- arquivo, evidência ou URL assinada;
- segredo de integração.

Logs devem usar `requestId` e `correlationId`. Identificadores de conta ou
organização só aparecem quando necessários e aprovados pela política de logs.
A allowlist aplicada, a defesa recursiva e as consultas seguras estão em
`docs/OBSERVABILITY.md`.

## Autenticação e sessão

- Senha local usa Argon2id versionado, NFC e o valor completo, sem `trim`,
  mudança de caixa ou truncamento.
- Criação/troca futura exige de 15 a 128 pontos de código, aceita Unicode sem
  composição obrigatória e aplica blocklist no fluxo que definir a senha.
- Conta ausente, hash ausente/inválido, senha incorreta e estado inelegível usam
  o mesmo erro e preservam trabalho caro comparável; o endpoint também exige
  rate limit.
- Access token tem validade de 15 minutos, `typ: at+jwt`, finalidade `access`,
  issuer/audience fixos e somente IDs opacos de conta/sessão; contexto
  organizacional e permissões não são congelados no payload.
- Refresh token tem chave, tipo, audience e finalidade separados do access,
  expira em até 30 dias e somente seu SHA-256 é persistido.
- Cada refresh rotaciona atomicamente o hash sem ampliar a expiração absoluta.
  Reutilização autenticada revoga defensivamente a sessão inteira.
- MFA e recuperação não podem revelar se uma conta existe.
- Sessões permitem revogação individual e global.

O login limita cinco tentativas por endereço de cliente a cada 60 segundos. O
Redis recebe somente um HMAC opaco, nunca IP, e qualquer falha do contador fecha
o endpoint com 503. Conta marcada com MFA também falha fechada sem access token
até existir challenge funcional. Os JWTs usam HS256 somente dentro da Manager
API, chaves distintas de ao menos 32 bytes e validação estrita de algoritmo,
tipo, finalidade, tempo, issuer e audience. Token expirado, alterado ou assinado
por outra chave recebe uma falha uniforme. O login persiste somente o hash do
refresh; nome de dispositivo e User-Agent são sanitizados, e IP não é armazenado
sem política aprovada. Respostas que contêm o par de tokens desabilitam cache
com `Cache-Control: no-store` e `Pragma: no-cache`.

O núcleo de credenciais consulta somente contas não excluídas, verifica o hash
mesmo antes de avaliar o estado e só confirma `last_login_at` se hash, estado
ativo e soft delete não mudaram concorrentemente. Eventos
`authentication.succeeded` e `authentication.failed` não recebem PII, ID da
conta ou motivo. O contrato completo e suas limitações estão em
[`../authentication/README.md`](../authentication/README.md), e a decisão
de senha no
[`ADR-009`](../decisions/ADR-009-local-password-authentication-and-argon2id.md).
A assinatura e o ciclo curto do access token estão no
[`ADR-010`](../decisions/ADR-010-short-lived-access-token.md).
Rotação, expiração absoluta e resposta a reuso estão no
[`ADR-011`](../decisions/ADR-011-refresh-token-rotation-and-reuse.md).

`auth_sessions` materializa a credencial corrente: token e IP em claro nunca
são gravados, hashes ficam fora da projeção de saída e atividade exige ausência
de revogação e prazo futuro. A rotação serializa concorrentes por sessão,
registra o último uso e revoga um sucessor quando um predecessor reaparece. O
contrato completo está em
[`../database/AUTH_SESSIONS.md`](../database/AUTH_SESSIONS.md).

## Autorização contextual

Permissões seguem `<recurso>.<ação>`. Papel não substitui autorização. Toda
decisão considera, conforme o recurso:

- conta autenticada;
- organização e unidade ativas;
- papel e permissão vigentes naquele contexto;
- vínculo com o recurso;
- finalidade e modo de acesso excepcional.

`break glass` exige justificativa, tempo limitado, auditoria reforçada e
notificação/revisão posterior. Nunca equivale a acesso irrestrito permanente.

`roles`, `permissions`, `role_permissions` e `account_roles` materializam
somente a fundação relacional. O catálogo TypeScript e o seed opcional de
desenvolvimento contêm 19 códigos técnicos, sem PII, papéis ou atribuições; a
migration de produção permanece sem dados e ainda não existe middleware de
autorização. Atribuições podem ter escopo global, de organização ou de unidade;
unidade sem organização é inválida e um papel inativo nunca deve conceder
acesso. A atribuição organizacional possui FK restritiva para `organizations`;
a atribuição de unidade usa FK composta e não aceita combinar uma organização
com unidade alheia. `organization_members` materializa os vínculos
organizacionais ou de unidade sem armazenar papel: a FK composta rejeita
unidade alheia, a unicidade trata unidade nula como igual e `is_active` controla
a vigência local. Um vínculo inativo nunca concede contexto, e um vínculo ativo
sozinho também não autoriza operação.

Papéis de sistema são estruturais: permanecem ativos e as mutações suportadas
pela aplicação devem rejeitá-los. O contrato completo, inclusive herança de
escopo e fronteiras dos tickets futuros, está em
[`../permissions/README.md`](../permissions/README.md).

O CNPJ identifica a pessoa jurídica e não recebe a classificação de dado
pessoal da vítima, mas continua fora de logs e projeções públicas por padrão.
`organizations` mantém o valor canônico apenas para integridade institucional;
consultas comuns usam nomes normalizados e localidade. Uma organização só é
operacional quando está ativa e não foi excluída logicamente. A habilitação de
integração é uma configuração separada e nunca reativa uma organização. O
contrato completo está em
[`../database/ORGANIZATIONS.md`](../database/ORGANIZATIONS.md).

`organization_units` mantém contato, endereço estruturado e posição geográfica
somente para operação institucional. A projeção padrão omite esses campos e o
logger redige endereço, e-mail, telefone, longitude, latitude e `position`.
Uma unidade só é operacional quando ela e sua organização estão ativas e não
excluídas. O contrato completo está em
[`../database/ORGANIZATION_UNITS.md`](../database/ORGANIZATION_UNITS.md).

Matrícula e cargo de membership são dados institucionais ligados à conta.
Ambos ficam fora de logs comuns, e a matrícula também fica fora da projeção
padrão. O contrato completo está em
[`../database/ORGANIZATION_MEMBERS.md`](../database/ORGANIZATION_MEMBERS.md).

## Emergência e filas

- O endpoint confirma apenas o que foi duravelmente aceito pelo sistema.
- Jobs são idempotentes, possuem retry limitado, backoff e tratamento de falha.
- Uma integração indisponível não apaga nem oculta o alerta original.
- Cada tentativa e transição relevante gera evento auditável sem conteúdo
  sensível em log.
- Dead letter exige monitoramento e procedimento operacional documentado.

## Redis

- `REDIS_URL`, credenciais, chaves e valores nunca aparecem em logs ou erros;
- produção usa rede restrita e TLS quando oferecido pelo provedor;
- namespace por ambiente evita colisão, mas não substitui isolamento de rede e
  credencial;
- cache, rate limit e locks não recebem dados pessoais ou sensíveis sem revisão
  explícita de finalidade, TTL e impacto de perda;
- o rate limit de login usa digest HMAC opaco, TTL obrigatório e incremento
  atômico; indisponibilidade bloqueia a autenticação;
- Redis não substitui PostgreSQL, auditoria ou controle de autorização.

Usos permitidos, formato das chaves e operação local estão em
[`../REDIS.md`](../REDIS.md).

## PostgreSQL e migrations

- `DATABASE_URL`, `DB_DATABASE_URL`, `DB_ATLAS` e credenciais nunca aparecem em
  logs, respostas ou saída deliberada de scripts;
- produção usa rede privada e TLS conforme o provedor; a porta do Compose local
  é restrita a loopback;
- migrations de estrutura são versionadas, têm checksum e não dependem de seed;
- seed aceita somente dados fictícios e não corrige schema;
- timezone do servidor, das sessões e dos instantes persistidos é UTC.

O fluxo reproduzível e os limites do pool estão em
[`../database/README.md`](../database/README.md).

## Evidências e objetos

- O banco armazena metadados; o conteúdo fica em storage privado.
- Download exige autorização no momento da solicitação.
- URLs assinadas têm validade curta e não são persistidas em logs.
- Upload valida tipo, tamanho e integridade; malware scanning deve ser avaliado
  antes de produção.
- Exclusão, retenção e cadeia de custódia dependem de regra jurídica registrada.

## LGPD e ciclo de vida

- Coletar apenas dados necessários à finalidade declarada.
- Definir base legal, retenção e responsáveis antes da produção.
- Registrar acesso e alteração de dados sensíveis.
- Permitir correção, restrição, exportação ou eliminação quando juridicamente
  aplicável, sem destruir registros que devam ser preservados.
- Seeds, fixtures, screenshots e ambientes de teste não usam dados reais.

## Validação obrigatória por ticket

Cada ticket que trate autenticação, autorização, dados sensíveis, emergência,
localização ou integração deve incluir:

- cenários autorizado, não autenticado, sem permissão e fora do escopo;
- tentativa de enumeração ou vazamento por erro;
- análise do que pode aparecer em logs;
- idempotência e concorrência quando houver escrita crítica;
- comportamento quando dependências externas falham;
- atualização do registro de implementação e, se necessário, ADR.

## Pendências que exigem decisão especializada

Algoritmos/parâmetros criptográficos, retenção legal, cadeia de custódia,
integração com autoridades e tempos de resposta operacionais devem ser
confirmados por segurança, jurídico e operação antes do go-live. Tickets não
devem inventar essas políticas.
