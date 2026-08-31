# ADR-011 — Rotação e detecção de reuso do refresh token

Status: Aceito
Data: 2026-08-31
Ticket: PROT-024

## Contexto

O login precisa criar uma sessão renovável sem persistir a credencial pura. A
rotação deve impedir dois sucessores válidos sob concorrência e ainda reconhecer
um token anterior depois que seu hash deixou de ser o valor corrente. Um token
opaco localizado somente pelo próprio hash perderia a relação com a sessão após
a primeira troca; guardar todo o histórico aumentaria schema, retenção e
superfície de segredo.

Também é necessário separar access e refresh tokens de forma inequívoca,
limitar a duração da sessão e reagir a reuso sem permitir que um valor aleatório
forjado revogue a sessão de outra pessoa.

## Decisão

- refresh tokens são JWTs assinados com `HS256` exclusivamente por
  `JWT_REFRESH_SECRET`, diferente de `JWT_ACCESS_SECRET` e com ao menos 32 bytes;
- o header exige `typ: rt+jwt`; issuer, audience específica de refresh e
  `token_use: refresh` são fixos e validados junto ao algoritmo;
- o payload contém somente `sub` e `sid` UUID v7 opacos, `jti` aleatório de 256
  bits, `iat` e `exp`. Não contém PII, dispositivo, organização, papel ou
  permissão;
- a validade inicial é de 30 dias e a expiração é absoluta: toda rotação mantém
  o mesmo `exp` e apenas reduz `refreshExpiresIn`;
- o valor completo do JWT recebe SHA-256 e somente o digest Base64url prefixado
  por `sha256:` entra em `auth_sessions.refresh_token_hash`. A credencial possui
  entropia aleatória e integridade criptográfica antes de o hash ser consultado;
- a sessão criada no login guarda o identificador técnico do dispositivo, nome
  e User-Agent sanitizados. `ip_hash` permanece nulo até existir algoritmo,
  chave, finalidade e retenção aprovados;
- a rotação abre transação, bloqueia a linha elegível de sessão/conta, compara o
  hash corrente e troca hash, `last_used_at`, `updated_at` e `version` no mesmo
  commit;
- um token com assinatura válida, mesma conta, `sid` e expiração, mas hash já
  substituído, prova relação com a sessão e é tratado como reuso. A sessão
  inteira é revogada; o servidor não tenta decidir se o cliente legítimo ou o
  atacante chegou primeiro;
- token malformado, expirado, alterado, assinado por outra chave, sessão ausente,
  conta inelegível, sessão revogada e reuso retornam o mesmo
  `INVALID_REFRESH_TOKEN`, sem IDs ou motivo;
- duas requisições simultâneas com o mesmo token produzem no máximo uma rotação.
  A segunda observa o hash novo, revoga a sessão defensivamente e faz com que o
  sucessor entregue pela vencedora também deixe de ser renovável.

A relação assinada no próprio token segue a opção de implementação descrita no
[RFC 9700, seção 4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2):
a rotação conserva a relação necessária para detectar replay e revoga a
credencial ativa quando um predecessor reaparece. Tipo explícito, audience
distinta, chave própria e regras de validação mutuamente exclusivas seguem o
[RFC 8725, seções 3.9, 3.11 e 3.12](https://www.rfc-editor.org/rfc/rfc8725.html).

## Alternativas consideradas

- Token aleatório localizado somente pelo hash: rejeitado porque o predecessor
  deixa de localizar a sessão após a troca, impedindo a detecção de reuso.
- Prefixar um token opaco apenas com `sid`: rejeitado porque qualquer pessoa que
  conhecesse o ID poderia enviar um valor falso e provocar revogação. A
  assinatura autentica a relação antes da consulta.
- Criar tabela de família ou histórico de hashes: tecnicamente válida, mas
  desnecessária neste contrato porque `sid`, conta e expiração possuem
  integridade no token. Pode ser adotada por migration forward se auditoria ou
  retenção futura exigir histórico durável de cada geração.
- Renovar a expiração a cada uso: rejeitado por permitir sessão indefinida. Uma
  nova autenticação é exigida ao final dos 30 dias.
- Revogar somente o token anterior e manter o sucessor: rejeitado porque o
  servidor não sabe qual participante da corrida possui a credencial legítima.
- Usar o segredo de access ou o mesmo audience/tipo: rejeitado por permitir
  confusão de finalidade e ampliar o impacto de uma chave comprometida.

## Consequências

A tabela existente já comporta a solução; nenhuma migration ou histórico de
token é necessário. O `sid` do access token passa a identificar uma linha real,
e cada sessão mantém no máximo um hash renovável corrente.

O bloqueio de linha serializa refreshes da mesma sessão sem bloquear sessões de
outros dispositivos. Uma repetição causada por retry simultâneo força novo
login, custo deliberado da política de comprometimento. Clientes precisam
substituir o refresh token de forma atômica e nunca repetir uma resposta antiga.

Rotação da chave de refresh exige estratégia de sobreposição ou invalidação de
sessões ainda ativas. Logout, revogação administrativa/global, middleware
Bearer, cookies/armazenamento nos clientes e política jurídica de retenção
continuam nos tickets posteriores.
