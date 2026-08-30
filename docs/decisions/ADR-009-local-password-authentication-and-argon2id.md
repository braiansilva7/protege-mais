# ADR-009 — Autenticação local e Argon2id

Status: Aceito
Data: 2026-08-30
Ticket: PROT-022

## Contexto

O login por e-mail não pode revelar se uma conta existe, possui senha local ou
está bloqueada. A verificação também precisa limitar abuso de entrada, suportar
Unicode sem alterar silenciosamente a senha e manter parâmetros de hash
auditáveis e evolutivos.

A escrita de `last_login_at` ocorre depois de um cálculo caro. Entre a leitura e
a escrita, outra operação pode trocar a senha, alterar o estado ou excluir
logicamente a conta; aceitar esse resultado criaria uma janela de corrida.

## Decisão

- novas senhas locais usam Argon2id versão 19 pelo pacote nativo `argon2`, com
  19.456 KiB de memória, duas iterações, paralelismo um, salt aleatório de 16
  bytes e saída de 32 bytes;
- o formato PHC persiste algoritmo, versão, parâmetros e salt junto ao hash;
  `needsRehash` sinaliza qualquer divergência, sem rehash automático neste
  ticket;
- senhas recebem somente normalização Unicode NFC. Não recebem `trim`, mudança
  de caixa ou truncamento;
- a política de criação/troca exige de 15 a 128 pontos de código, permite
  espaços e Unicode e não impõe composição por classes. Blocklist é obrigatória
  no futuro fluxo de definição de senha;
- o login não rejeita antecipadamente senha curta. Conta ausente ou sem hash,
  formato inválido e entrada acima do máximo executam Argon2id contra um hash
  fictício público com os parâmetros atuais e sempre falham;
- somente conta não excluída e `active`, com senha correta, é elegível. A
  resposta inválida e o evento de falha não distinguem os demais motivos;
- `last_login_at` usa atualização condicional ao UUID, hash observado, estado
  ativo e ausência de soft delete. Zero linhas atualizadas invalida a tentativa;
  `GREATEST` evita regressão de instantes concorrentes;
- auditoria de sucesso/falha não recebe identificador, e-mail, estado ou motivo.
  Correlação operacional pode vir do logger contextual externo;
- o caso de uso permanece independente de HTTP e Redis. A rota final deve
  aplicar rate limit antes de expor o fluxo e reutilizar o mesmo contrato de
  erro.

Os parâmetros seguem o mínimo Argon2id atual do OWASP para a combinação
memória/iterações/paralelismo adotada. Argon2id, versão 19 e salt de 16 bytes
também são compatíveis com as recomendações do
[RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html). A política de senha
segue o [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)
para comprimento, Unicode, ausência de composição e blocklist. A referência de
parâmetros é o
[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Alternativas consideradas

- bcrypt: rejeitado como padrão novo por sua limitação histórica de entrada e
  por Argon2id oferecer resistência memory-hard com recomendação atual direta;
- scrypt: tecnicamente aceitável, mas rejeitado porque Argon2id é a primeira
  escolha da referência adotada e possui suporte maduro no runtime atual;
- PBKDF2: rejeitado na ausência de requisito FIPS, pois exigiria custo muito
  maior e não fornece a mesma propriedade memory-hard;
- retornar erro de conta bloqueada ou sem senha: rejeitado por permitir
  enumeração de existência, estado e método de identidade;
- ignorar a consulta ou o hash para e-mail inválido/ausente: rejeitado por criar
  um atalho temporal observável;
- atualizar `last_login_at` apenas pelo UUID: rejeitado porque aceitaria uma
  autenticação invalidada por troca de senha ou estado concorrente;
- exigir optimistic lock da versão lida: rejeitado porque atualizações não
  relacionadas fariam logins válidos falharem. A comparação direta do hash e
  dos estados relevantes protege a decisão sem esse acoplamento;
- pepper global: adiado porque ainda não existe ciclo de provisionamento,
  rotação, recuperação e segregação do segredo. Introduzi-lo sem esse contrato
  aumentaria o risco operacional;
- rehash automático após sucesso: adiado para uma escrita separada e resiliente
  futura; o login não deve falhar por manutenção oportunista do hash.

## Consequências

Tentativas inválidas realizam consulta e trabalho Argon2id comparáveis, e todos
os estados inelegíveis compartilham o mesmo erro externo. Isso reduz canais de
enumeração, mas não substitui rate limit nem promete tempo constante através de
rede, banco, pool ou scheduler.

O custo escolhido é um baseline e precisa de benchmark na infraestrutura de
produção antes do go-live. Aumentos futuros podem ser detectados por
`needsRehash`; redução de custo, mudança de algoritmo, adoção de pepper ou
migração oportunista exigem nova decisão e testes de capacidade.

A dependência possui código nativo e seu script de instalação fica em allowlist
explícita do pnpm. Atualizações continuam bloqueadas pelo lockfile e exigem
revisão de supply chain e compatibilidade com Node.js.

Não há endpoint nem sessão emitida no `PROT-022`. Portanto o núcleo ainda não é
alcançável externamente; `PROT-023` deve compô-lo com schema, OpenAPI, tradução,
correlação, rate limit e tokens sem enfraquecer o contrato uniforme.
