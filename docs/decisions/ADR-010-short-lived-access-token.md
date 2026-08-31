# ADR-010 — Access token curto e restrito à Manager API

Status: Aceito
Data: 2026-08-31
Ticket: PROT-023

## Contexto

O login precisa emitir uma credencial verificável sem transportar PII, segredo
ou uma fotografia de papéis e escopos que possa ficar obsoleta. Ainda existe um
único emissor e consumidor, ambos dentro da Manager API; refresh token, sessão
persistida e middleware de autenticação pertencem a tickets posteriores.

O contrato também precisa impedir confusão entre tipos de JWT, limitar a janela
de uma credencial ainda não revogável e rejeitar algoritmo, issuer ou audience
não esperados.

## Decisão

- access tokens usam JWT assinado com `HS256` por `jose` `6.2.10`;
- `JWT_ACCESS_SECRET` tem ao menos 32 bytes, é exclusivo desta capacidade e
  nunca é publicado, persistido ou registrado;
- o header exige `alg: HS256` e `typ: at+jwt`;
- o payload exige `sub`, `sid`, `iat`, `exp`, `iss`, `aud` e
  `token_use: access`;
- `sub` e `sid` são UUID v7 opacos; `sid` representa uma sessão lógica até o
  `PROT-024` criar a credencial persistida;
- issuer é `urn:protege-mais:authentication`, audience é
  `urn:protege-mais:manager-api` e a validade é exatamente 900 segundos;
- o verificador aceita somente o algoritmo, tipo, finalidade, issuer e audience
  definidos, usa tolerância de relógio zero e rejeita emissão futura;
- organização, unidade, papel e permissão são resolvidos no estado vigente e não
  entram no token;
- o mesmo segredo deriva somente o identificador HMAC do rate limit, com
  separação de domínio explícita. Ele não deriva outra credencial;
- uma conta marcada com MFA não recebe token enquanto o challenge do `PROT-028`
  não existir.

O tipo `at+jwt` e a validação explícita de issuer/audience seguem o perfil de
access tokens do [RFC 9068](https://www.rfc-editor.org/rfc/rfc9068.html). Os
claims temporais seguem o [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519.html),
e o mínimo de 256 bits da chave acompanha o requisito de HMAC SHA-256 do
[RFC 7518, seção 3.2](https://www.rfc-editor.org/rfc/rfc7518.html#section-3.2).
A implementação usa a API documentada do
[`jose`](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md)
com allowlist de algoritmo e validações adicionais do domínio.

## Alternativas consideradas

- `RS256` ou `EdDSA`: adequados quando emissor e consumidores possuem fronteiras
  de deploy distintas, mas adiados porque hoje há somente uma Manager API e a
  distribuição/rotação de chaves assimétricas adicionaria operação sem reduzir a
  exposição entre serviços;
- token opaco persistido: rejeitado neste ticket porque anteciparia sessão e
  refresh token do `PROT-024`;
- validade maior: rejeitada por ampliar a janela sem revogação imediata;
- incluir papéis, organização ou unidade: rejeitado porque esse estado muda e
  precisa ser decidido no momento da operação;
- aceitar uma lista de algoritmos para migração futura: rejeitado por aumentar
  a superfície de confusão antes de existir um plano de rotação;
- usar o refresh secret ou um valor fixo para o rate limit: rejeitado por
  misturar finalidades ou introduzir segredo fraco. A derivação atual possui
  contexto exclusivo e pode migrar para chave própria sem alterar chaves
  públicas.

## Consequências

Um token alterado, expirado, assinado com outra chave ou emitido para outra
fronteira falha uniformemente. O payload minimizado não autoriza por si só e não
vaza contexto institucional ao cliente.

Até o `PROT-024`, `sid` não é consultável nem revogável e não existe refresh
token. A janela residual máxima é 15 minutos. O `PROT-029` conectará a
verificação ao request; nenhuma rota fica protegida apenas por este ADR.

HS256 exige que todo verificador conheça a chave de assinatura. Se a verificação
atravessar uma nova fronteira de serviço, uma nova decisão deve migrar para
assinatura assimétrica, definir `kid`, rotação e sobreposição de chaves. A rotação
do segredo atual deve considerar tokens ainda válidos e pode exigir uma janela
controlada com chave anterior.
