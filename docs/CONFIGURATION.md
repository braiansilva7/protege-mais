# Configuração de ambiente

## Fonte única

`packages/config` é a única camada autorizada a ler variáveis de ambiente. O
package carrega o `.env` da raiz sem sobrescrever valores já definidos pelo
processo, valida as chaves e entrega objetos TypeScript `readonly` congelados em
runtime.

Manager API e Worker validam a configuração antes de iniciar seus processos. O
Vite valida o Web ao carregar `vite.config.ts`, e o Expo valida o Mobile ao
resolver `app.config.ts`. Um valor ausente ou inválido interrompe o bootstrap
com `ConfigurationError`; a mensagem contém somente o nome da chave e nunca o
valor recebido.

Valores de `VITE_*` e `EXPO_PUBLIC_*` são públicos e podem ser incorporados aos
bundles. Segredos nunca devem usar esses prefixos.

## Ambientes aceitos

Os ambientes aceitos são `LOCAL`, `DEV`, `HMG` e `PROD`. A comparação não
diferencia maiúsculas de minúsculas, e o objeto resultante sempre usa a forma
normalizada em maiúsculas.

## Matriz mínima por app

| Variável                      | Manager API          | Worker               | Web         | Mobile      | Regra principal                          |
| ----------------------------- | -------------------- | -------------------- | ----------- | ----------- | ---------------------------------------- |
| `APP_ENVIRONMENT`             | Obrigatória          | Obrigatória          | —           | —           | `LOCAL`, `DEV`, `HMG` ou `PROD`          |
| `LOG_LEVEL`                   | Default fora de PROD | Default fora de PROD | —           | —           | Nível listado abaixo                     |
| `API_HOST`                    | Default fora de PROD | —                    | —           | —           | Host sem protocolo, path ou query        |
| `API_PORT`                    | Default fora de PROD | —                    | —           | —           | Inteiro entre 1 e 65535                  |
| `CORS_ORIGIN`                 | Obrigatória          | —                    | —           | —           | Uma ou mais origens HTTP(S), por vírgula |
| `DATABASE_URL`                | Obrigatória          | —                    | —           | —           | URL `postgres://` ou `postgresql://`     |
| `REDIS_URL`                   | Obrigatória          | Obrigatória          | —           | —           | URL `redis://` ou `rediss://`            |
| `JWT_ACCESS_SECRET`           | Obrigatória          | —                    | —           | —           | Segredo HMAC com ao menos 32 bytes       |
| `VITE_APP_ENVIRONMENT`        | —                    | —                    | Obrigatória | —           | Ambiente público do Web                  |
| `VITE_API_URL`                | —                    | —                    | Obrigatória | —           | URL HTTP(S) pública da API               |
| `EXPO_PUBLIC_APP_ENVIRONMENT` | —                    | —                    | —           | Obrigatória | Ambiente público do Mobile               |
| `EXPO_PUBLIC_API_URL`         | —                    | —                    | —           | Obrigatória | URL HTTP(S) pública da API               |

Defaults fora de produção:

| Variável    | Default     |
| ----------- | ----------- |
| `LOG_LEVEL` | `info`      |
| `API_HOST`  | `127.0.0.1` |
| `API_PORT`  | `3000`      |

Em `PROD`, essas três chaves precisam ser explícitas. Não há default para
origem CORS, banco, URLs públicas ou qualquer segredo.

## Configurações de capacidades

As configurações de capacidades ficam centralizadas mesmo antes de todos os
consumidores existirem. Cada validador também exige `APP_ENVIRONMENT`. Redis é
carregado pela Manager API e pelo Worker desde o `PROT-009`; as demais
capacidades só tornam suas chaves obrigatórias quando o app passa a carregá-las.

| Capacidade   | Variáveis obrigatórias                                                             | Validação                                                           |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Banco        | `DATABASE_URL`                                                                     | Protocolos PostgreSQL                                               |
| Redis        | `REDIS_URL`                                                                        | `redis://` ou `rediss://`, database numérico e sem query/fragment   |
| JWT          | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                          | Ao menos 32 bytes, sem espaços externos e diferentes entre si       |
| Criptografia | `ENCRYPTION_KEY`                                                                   | Não vazia e sem espaços externos                                    |
| S3           | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`          | Endpoint HTTP(S), bucket compatível com S3 e credenciais não vazias |
| SMTP         | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Host, porta, booleano estrito e remetente com e-mail válido         |

`LOG_LEVEL` aceita `trace`, `debug`, `info`, `warn`, `error`, `fatal` e
`silent`. O valor controla Manager API e Worker sem alterar o formato JSON ou a
política de redaction; nenhum nível permite dados sensíveis. `SMTP_SECURE`
aceita somente `true` ou `false`. O contrato dos logs está em
[`OBSERVABILITY.md`](OBSERVABILITY.md).

Em produção, marcadores conhecidos de exemplo, como `change-me`, `admin` e os
valores `change-before-production` do `.env.example`, são rejeitados quando
usados em campos secretos ou na credencial das URLs de banco e Redis.
O hash de senha local não adiciona variável: algoritmo e parâmetros ficam
versionados em código e no
[`ADR-009`](decisions/ADR-009-local-password-authentication-and-argon2id.md).
Pepper não foi adotado sem um ciclo aprovado de segredo e rotação. Desde o
`PROT-023`, a Manager API carrega `JWT_ACCESS_SECRET` para assinar e validar
tokens HS256 e derivar chaves opacas de rate limit com separação de domínio. O
valor deve ser aleatório, injetado pelo secret manager e rotacionado por um
procedimento que considere os tokens de 15 minutos ainda em circulação. Nunca
o reutilize como `JWT_REFRESH_SECRET`; este último continua reservado ao
`PROT-024`. A configuração isolada de JWT valida ambos quando chamada.
Criptografia das demais capacidades futuras e seus segredos continuam definidos
por seus tickets. Timeouts, namespace e operação do Redis estão em
[`REDIS.md`](REDIS.md). O pool PostgreSQL recebe somente a URL
já validada; limites, timeouts, sessões UTC e operação ficam em
[`database/README.md`](database/README.md).

## Variáveis exclusivas de infraestrutura

`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_DATABASE_URL` e
`DB_ATLAS` são consumidas pelo Docker Compose, pelo PostgreSQL ou pelo Atlas.
Elas permanecem no `.env.example`, mas não fazem parte do objeto de runtime dos
apps. As duas URLs Atlas devem limitar o `search_path` a `public`; são lidas
pelo `atlas.hcl` a partir do ambiente e nunca impressas pelos scripts.

## Uso local

1. Copie `.env.example` para `.env`.
2. Substitua os marcadores locais conforme o ambiente. Em dispositivo físico,
   ajuste `EXPO_PUBLIC_API_URL` para um endereço alcançável pelo aparelho.
3. Inicie PostgreSQL, Redis e a base de desenvolvimento do Atlas com
   `docker compose up -d --wait db redis atlas-db`.
4. Execute `pnpm migrate:local`; o seed continua opcional.
5. Inicie o app desejado pelos scripts da raiz.

O `.env` não é versionado. Variáveis fornecidas diretamente pelo processo têm
prioridade sobre o arquivo, o que permite injeção segura por container ou
plataforma de deploy.

Exemplos de falha sanitizada:

```text
Configuração ausente: DATABASE_URL.
Configuração inválida: API_PORT.
Configuração insegura para produção: JWT_ACCESS_SECRET.
```

Nunca registre o objeto completo de configuração nem inclua valores recebidos
em mensagens de erro.

---

Documentação Protege Mais — Configuração de ambiente
