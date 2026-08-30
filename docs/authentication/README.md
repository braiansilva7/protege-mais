# Autenticação local

## Estado atual

O `PROT-022` entrega o núcleo reutilizável de autenticação por e-mail e senha:
normalização da chave de busca, verificação Argon2id, elegibilidade da conta,
atualização concorrente de `last_login_at` e eventos de sucesso ou falha sem
PII. Ainda não existe rota HTTP de login, emissão de token, criação/troca de
senha ou sessão funcional. Esses fluxos começam no `PROT-023` e devem compor os
contratos aqui definidos, sem duplicar a regra de credenciais.

O rate limit é obrigatório no contrato HTTP final. Ele não pertence ao caso de
uso porque o núcleo também será reutilizado fora do transporte HTTP e não deve
depender de IP, Redis ou Fastify.

## Fluxo de autenticação

`AuthenticateWithEmailAndPassword` executa sempre esta sequência:

1. aplica `trim + lowercase` ao e-mail, usando a mesma normalização de
   `accounts.email_normalized`;
2. consulta somente uma conta não excluída e projeta apenas `id`, hash, estado e
   indicador de MFA;
3. executa exatamente uma verificação de senha. Conta ausente, e-mail inválido,
   identidade externa sem senha local e senha acima do limite usam um hash
   Argon2id fictício e público para preservar o trabalho caro;
4. aceita somente hash compatível, senha correta e conta com estado `active`;
5. atualiza `last_login_at` por escrita condicional ao mesmo UUID, hash, estado
   ativo e ausência de soft delete;
6. emite um evento estruturado sem identificadores e devolve somente
   `accountId` e `mfaEnabled`.

Se senha ou hash mudar, a conta for bloqueada/desabilitada ou ocorrer soft
delete entre a leitura e a escrita, a atualização afeta zero linhas e a
tentativa falha. `GREATEST` impede regressão temporal entre logins concorrentes;
cada escrita confirmada incrementa `version`.

## Contrato não enumerável

Conta inexistente, e-mail malformado, senha incorreta, hash ausente ou inválido,
conta `blocked`, conta `disabled`, soft delete e conflito concorrente produzem o
mesmo `InvalidCredentialsError`:

```json
{
  "statusCode": 401,
  "code": "INVALID_CREDENTIALS",
  "messageKey": "authentication.invalidCredentials"
}
```

A futura fronteira HTTP traduzirá a mensagem pelo mecanismo global e incluirá
somente os campos públicos já aprovados para erros. Motivo interno, estado da
conta, hash, e-mail e senha nunca fazem parte da exceção, da resposta ou do
evento. A equivalência de resposta e a presença de trabalho Argon2id reduzem
enumeração; não oferecem garantia de tempo constante contra variação de host,
pool, banco ou scheduler. O rate limit do endpoint continua uma defesa
obrigatória em profundidade.

## Política aprovada de senha

Para criação e troca futuras, a aplicação deve:

- normalizar em Unicode NFC antes do hash;
- exigir de 15 a 128 pontos de código;
- aceitar espaços e caracteres Unicode, sem regra de composição por classe;
- rejeitar valor formado somente por espaços e caracteres de controle C0/C1;
- verificar o valor completo, sem `trim`, conversão de caixa ou truncamento;
- comparar novas senhas com uma blocklist de valores comuns ou comprometidos no
  fluxo que as definir.

O helper `isValidNewAuthenticationPassword` cobre a regra sintática. A
blocklist exige fonte, atualização e tratamento operacional próprios e deverá
ser integrada pelos tickets de criação/recuperação; sua ausência não pode ser
interpretada como autorização para persistir senha nova hoje.

No login, o comprimento mínimo não é usado como atalho: uma entrada curta ainda
passa pela verificação cara. Apenas o máximo limita trabalho e memória antes de
substituir a entrada por uma senha fictícia de tamanho controlado.

## Hash e evolução

O serviço usa `argon2` `0.45.1` com Argon2id versão 19, salt aleatório da
biblioteca com 16 bytes, saída de 32 bytes e estes custos:

| Parâmetro     | Valor      |
| ------------- | ---------- |
| memória       | 19.456 KiB |
| iterações     | 2          |
| paralelismo   | 1          |
| comprimento   | 32 bytes   |
| versão Argon2 | 19         |

O formato PHC codifica algoritmo, versão, custos, salt e resultado. Não existe
pepper neste incremento: adotá-lo exige segredo gerenciado, rotação e plano de
recuperação que ainda não foram aprovados. `needsRehash` detecta hash legado,
malformado ou com parâmetros diferentes, mas o login atual não reescreve a
credencial. Uma futura migração oportunista deve ser atômica e não pode tornar
a autenticação dependente de uma segunda escrita.

O build nativo de `argon2` está explicitamente permitido em
`pnpm-workspace.yaml`; novas dependências com scripts continuam bloqueadas até
revisão deliberada.

## Composição e auditoria

As fronteiras vivem em `@protege-mais/interfaces`; o adaptador Drizzle, o
serviço Argon2id e o caso de uso recebem dependências explicitamente por
construtor. A futura composição da Manager API deve registrar uma instância por
processo usando o `DatabaseRw`, o logger seguro e o relógio do sistema.

Os únicos eventos atuais são:

- `authentication.succeeded`, em nível `info`;
- `authentication.failed`, em nível `warn`.

O contrato de auditoria não aceita argumentos, impedindo e-mail, ID da conta ou
motivo da falha por construção. O logger da requisição poderá acrescentar
`requestId` e `correlationId`; payload, credencial e identificadores pessoais
continuam proibidos. Estes eventos operacionais não substituem a trilha durável
de auditoria prevista em tickets posteriores.

## Fronteiras dos próximos tickets

- `PROT-023`: rota de login, schema/OpenAPI, rate limit, composição do caso de
  uso e emissão de access token;
- `PROT-024`: criação, rotação e revogação funcional da sessão/refresh token;
- `PROT-027`: recuperação e troca de senha, incluindo blocklist;
- `PROT-028`: desafio e confirmação do segundo fator quando `mfaEnabled` for
  verdadeiro.

A autenticação de credenciais não concede papel, permissão, membership ou
contexto organizacional. Autorização permanece uma decisão separada.

---

Documentação Protege Mais — Autenticação local
