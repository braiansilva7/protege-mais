# Qualidade de código

Este documento descreve a configuração entregue pelo `PROT-002`. As regras se
aplicam aos quatro apps e aos dez packages do monorepo.

## Runtime suportado

- Node.js `24.12.0`;
- pnpm `11.9.0`, declarado em `packageManager`;
- TypeScript `6.0.x`.

A versão do Node é declarada em `engines` e conferida pelo `preinstall`. A
instalação deve ser executada pela raiz para que o lockfile e todos os
workspaces permaneçam sincronizados.

## Configuração TypeScript

`tsconfig.base.json` concentra as regras independentes de runtime:

- `strict`, `noImplicitAny` e `strictNullChecks` habilitados;
- erros capturados tratados inicialmente como `unknown`;
- diferença de maiúsculas e minúsculas em nomes de arquivo rejeitada;
- emissão bloqueada quando há erro de tipo.

O `tsconfig.json` da raiz especializa essa base para Node.js e mantém os aliases
explícitos `@protege-mais/*`. Manager API e Worker estendem a configuração Node;
Web combina a base com o modo Bundler; Mobile combina a base com a configuração
do Expo. Cada package possui seu próprio `tsconfig.json`, de modo que também
pode ser validado isoladamente. A Manager API inclui os testes em seu
`tsconfig.json` de qualidade e usa `tsconfig.build.json` para excluí-los do
artefato de produção.

## ESLint e uso de `any`

`eslint.config.mjs` usa flat config, regras com informação de tipos para
TypeScript, regras oficiais para Vue e React Hooks e compatibilidade com o
Prettier. Warnings também interrompem o comando.

`any` explícito é proibido por `@typescript-eslint/no-explicit-any`. Quando uma
fronteira externa realmente não oferece um tipo utilizável, a exceção deve ser
restrita à linha necessária e explicar o motivo após `--`:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK externo ainda não publica o contrato.
export type ExternalPayload = any;
```

Desabilitações sem descrição, desabilitações de arquivo inteiro e comentários
de lint que deixaram de ser necessários são rejeitados. Prefira `unknown`, um
tipo genérico ou um contrato explícito antes de criar uma exceção.

## Formatação

O Prettier é a fonte de verdade para estilo mecânico: dois espaços, ponto e
vírgula, aspas simples, largura de 80 colunas, fim de linha LF e trailing comma
compatível com ES5. Não ajuste manualmente um arquivo para contrariar o
formatter.

Dependências e artefatos gerados (`node_modules`, `dist`, `.turbo`, `.expo`,
`coverage`, `.pnpm-store` e `*.tsbuildinfo`) ficam fora do lint, da formatação e,
quando aplicável, do Git e do contexto Docker. O `pnpm-lock.yaml` é mantido pelo
pnpm e não é reformatado pelo Prettier.

## Comandos

Na raiz:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @protege-mais/plugins test:database
pnpm --filter @protege-mais/plugins test:redis
pnpm --filter @protege-mais/worker test:redis
pnpm format:check
pnpm build
```

`lint` e `typecheck` percorrem os 14 workspaces pelo Turbo; `test` executa as
suítes de configuração, classes comuns, handler Fastify, i18n, PostgreSQL e
Redis com conexões injetáveis, logging, redaction, correlação, filas,
processors, casos de uso, readiness, endpoints operacionais, OpenAPI e
shutdown. `test:database`, executado após
`docker compose up -d --wait db atlas-db` e `pnpm migrate:local`, comprova query
Drizzle, UTC, PostGIS, SRID 4326, distância geodésica, indisponibilidade,
recuperação e fechamento contra PostgreSQL real. Os dois comandos
`test:redis`, executados após `docker compose up -d --wait redis`, comprovam o
cliente genérico e o pipeline real do Worker. A integração do Worker cobre
retry/backoff reduzido, idempotência após reinício, falha terminal e shutdown
durante processamento;
`build` gera os quatro apps. O teste de OpenAPI valida estrutura e referências,
contrato operacional, exemplos, security e exposição da UI por ambiente. As
configurações compartilhadas fazem parte das dependências globais do cache do
Turbo, portanto sua alteração invalida as tarefas afetadas. Objetos hostis e
campos proibidos devem fazer parte dos testes sempre que um novo contexto de
log for criado.
Para conferir explicitamente o formatter em cada workspace:

```bash
pnpm -r --if-present format:check
```

Para corrigir formatação, use `pnpm format`. Os mesmos comandos `lint`,
`typecheck`, `format` e `format:check` existem em cada workspace e podem ser
executados com filtro, por exemplo:

```bash
pnpm --filter @protege-mais/common lint
pnpm --filter @protege-mais/web typecheck
```

Exemplos controlados confirmaram que parâmetro sem tipo, atribuição de `null` a
`string` e `any` explícito são rejeitados. Esses casos foram exercitados em
memória durante o ticket, sem manter arquivos propositalmente inválidos no
repositório.
