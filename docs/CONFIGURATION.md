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

As integrações abaixo ainda pertencem aos tickets indicados no roadmap, mas
seus contratos de configuração já estão centralizados. Cada validador também
exige `APP_ENVIRONMENT`. Uma capacidade só torna suas chaves obrigatórias quando
o app passa a carregá-la.

| Capacidade   | Variáveis obrigatórias                                                             | Validação                                                           |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Banco        | `DATABASE_URL`                                                                     | Protocolos PostgreSQL                                               |
| Redis        | `REDIS_URL`                                                                        | `redis://` ou `rediss://`                                           |
| JWT          | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                          | Não vazias, sem espaços externos e diferentes entre si              |
| Criptografia | `ENCRYPTION_KEY`                                                                   | Não vazia e sem espaços externos                                    |
| S3           | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`          | Endpoint HTTP(S), bucket compatível com S3 e credenciais não vazias |
| SMTP         | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Host, porta, booleano estrito e remetente com e-mail válido         |

`LOG_LEVEL` aceita `trace`, `debug`, `info`, `warn`, `error`, `fatal` e
`silent`. `SMTP_SECURE` aceita somente `true` ou `false`.

Em produção, marcadores conhecidos de exemplo, como `change-me`, `admin` e os
valores `change-before-production` do `.env.example`, são rejeitados quando
usados em campos secretos ou na credencial da URL do banco. Parâmetros e
algoritmos criptográficos continuam fora do escopo deste ticket e serão
definidos pelos tickets de segurança.

## Variáveis exclusivas de infraestrutura

`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_DATABASE_URL` e
`DB_ATLAS` são consumidas pelo Docker Compose, pelo PostgreSQL ou pelo Atlas.
Elas permanecem no `.env.example`, mas não fazem parte do objeto de runtime dos
apps.

## Uso local

1. Copie `.env.example` para `.env`.
2. Substitua os marcadores locais conforme o ambiente. Em dispositivo físico,
   ajuste `EXPO_PUBLIC_API_URL` para um endereço alcançável pelo aparelho.
3. Inicie o app desejado pelos scripts da raiz.

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
