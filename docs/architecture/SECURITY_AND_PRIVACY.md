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
- CPF, endereço e dados médicos;
- relatos da vítima e conteúdo de ocorrência;
- coordenadas ou locais protegidos;
- arquivo, evidência ou URL assinada;
- segredo de integração.

Logs devem usar `requestId` e `correlationId`. Identificadores de conta ou
organização só aparecem quando necessários e aprovados pela política de logs.
A allowlist aplicada, a defesa recursiva e as consultas seguras estão em
`docs/OBSERVABILITY.md`.

## Autenticação e sessão

- Senha utiliza algoritmo de hash adequado e parâmetros versionados.
- Access token tem validade curta e finalidade explícita.
- Refresh token é armazenado como hash, rotacionado e revogável por sessão.
- Reutilização de refresh token rotacionado deve causar resposta defensiva.
- MFA e recuperação não podem revelar se uma conta existe.
- Sessões permitem revogação individual e global.

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
