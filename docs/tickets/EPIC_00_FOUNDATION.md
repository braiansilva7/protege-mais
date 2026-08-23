# EPIC 00 — Fundação do Protege Mais

Este épico transforma o template atual em uma fundação coerente, observável e
executável para um sistema crítico. Todos os tickets estão inicialmente
`Pendente`.

## PROT-000

### Sanear o legado e congelar o baseline

| Campo        | Valor           |
| ------------ | --------------- |
| Status       | Concluído       |
| Tipo         | Technical Story |
| Prioridade   | P0              |
| Dependências | Nenhuma         |

**Objetivo:** identificar e remover de forma controlada os domínios herdados do
template anterior, preservando somente capacidades genéricas deliberadamente
aprovadas.

**Escopo:** inventariar models, migrations, seeds, rotas, permissões, telas,
traduções e assets; classificar cada item como manter, adaptar ou remover;
eliminar referências a jogo, jogador, pergunta, resposta, pontuação e coringa;
garantir que o banco possa continuar vazio até `PROT-011`.

**Fora do escopo:** criar entidades do Protege Mais ou redesenhar autenticação.

**Critérios de aceite:** não restam domínios do produto anterior no código
executável; API/Web/Mobile mantêm um shell mínimo compilável; migrations e seeds
legados não recriam tabelas removidas; a decisão de reaproveitamento está
registrada no changelog.

**Testes:** busca textual pelo legado; `pnpm typecheck`; `pnpm build`; inicialização
do shell da API e Web; inspeção do plano Atlas sem aplicar dados antigos.

**Documentação:** atualizar `PROJECT_ARCHITECTURE.md`, README, catálogo de rotas,
modelo de dados atual e changelog.

## PROT-001

### Consolidar a estrutura do monorepo

| Campo        | Valor           |
| ------------ | --------------- |
| Status       | Concluído       |
| Tipo         | Technical Story |
| Prioridade   | P0              |
| Dependências | PROT-000        |

**Objetivo:** reconciliar a estrutura já existente com a arquitetura-alvo e
adicionar o workspace `apps/worker` sem desenvolver fluxos de negócio.

**Escopo:** reconhecer `manager_api`, `web`, `mobile` e `worker` no pnpm/Turbo;
consolidar packages compartilhados e aliases TypeScript; criar entrypoints
mínimos e scripts `dev`, `build` e `typecheck`; documentar responsabilidades.

**Fora do escopo:** filas reais, Redis e telas funcionais do Mobile.

**Critérios de aceite:** instalação reconhece todos os workspaces; cada app
inicia ou permanece aguardando trabalho conforme sua função; packages não
dependem de apps; build e typecheck podem ser executados na raiz.

**Testes:** `pnpm -r list --depth -1`; typecheck/build raiz; smoke test de
inicialização isolada dos quatro apps.

**Documentação:** atualizar estrutura atual, comandos no README e changelog.

## PROT-002

### Configurar TypeScript, lint e formatter

| Campo        | Valor           |
| ------------ | --------------- |
| Status       | Pendente        |
| Tipo         | Technical Story |
| Prioridade   | P0              |
| Dependências | PROT-001        |

**Objetivo:** estabelecer uma configuração comum de qualidade para todos os
workspaces.

**Escopo:** TypeScript strict, `noImplicitAny`, `strictNullChecks`, aliases,
ESLint e Prettier; scripts raiz e por workspace; exceção a `any` somente com
justificativa localizada e regra de lint apropriada.

**Critérios de aceite:** `pnpm lint`, `pnpm typecheck` e `pnpm format:check`
finalizam sem erro; um exemplo inválido controlado é rejeitado pela configuração;
arquivos gerados e dependências são ignorados corretamente.

**Testes:** comandos de qualidade na raiz e em cada workspace; build após as
configurações.

**Documentação:** comandos, versão do runtime e convenções de código.

## PROT-003

### Centralizar e validar configurações

| Campo        | Valor           |
| ------------ | --------------- |
| Status       | Pendente        |
| Tipo         | Technical Story |
| Prioridade   | P0              |
| Dependências | PROT-001        |

**Objetivo:** tornar `packages/config` a única porta de entrada para variáveis de
ambiente.

**Escopo:** validar ambiente, host/porta da API, banco, Redis, segredos JWT,
chave de criptografia, S3, SMTP e log level; expor objeto tipado e imutável;
separar configurações obrigatórias por app; atualizar `.env.example` sem
segredos reais.

**Regras:** nenhum app acessa `process.env` fora do package; erros citam a chave
ausente sem revelar valor; produção não aceita defaults inseguros.

**Critérios de aceite:** cada app inicia com seu conjunto mínimo; variável
obrigatória ausente impede início com erro sanitizado; valores inválidos são
rejeitados; a busca por `process.env` fora do package retorna zero.

**Testes:** unitários da validação, smoke tests por app e cenários de ausência,
tipo inválido e segredo vazio.

**Documentação:** matriz de variáveis por ambiente e changelog.

## PROT-004

### Implantar o padrão global de erros

| Campo        | Valor           |
| ------------ | --------------- |
| Status       | Pendente        |
| Tipo         | Technical Story |
| Prioridade   | P0              |
| Dependências | PROT-002        |

**Objetivo:** padronizar erros de domínio e infraestrutura sem vazar detalhes.

**Escopo:** `ApplicationError`, `ValidationError`, `UnauthorizedError`,
`ForbiddenError`, `NotFoundError`, `ConflictError`, `BusinessRuleError` e
`InfrastructureError`; handler Fastify; resposta com `code`, `message` e
`requestId`; mapeamento previsível para status HTTP.

**Regras:** stack e causa interna nunca chegam ao cliente em produção;
controller/use case não usa `Error` genérico para regra prevista.

**Critérios de aceite:** cada classe produz status e código corretos; erro
desconhecido vira resposta genérica 500 com requestId; validação não expõe dado
sensível; o erro original permanece disponível apenas no log seguro.

**Testes:** unitários das classes/mapeamentos e integração do handler para 400,
401, 403, 404, 409 e 500.

**Documentação:** contrato comum de erro em `docs/api` e changelog.

## PROT-005

### Consolidar internacionalização do backend

| Campo        | Valor           |
| ------------ | --------------- |
| Status       | Pendente        |
| Tipo         | Technical Story |
| Prioridade   | P1              |
| Dependências | PROT-004        |

**Objetivo:** disponibilizar mensagens equivalentes em `pt-BR`, `en` e `es`.

**Escopo:** normalizar locale padrão para `pt-BR`; fallback; negociação por
`Accept-Language`; chaves comuns de erro, saúde e autenticação; validação de
paridade entre catálogos.

**Critérios de aceite:** locale suportado retorna tradução correspondente;
locale desconhecido usa fallback; todas as chaves existem nos três catálogos;
erro mantém `code` estável independentemente da tradução.

**Testes:** unitários de resolução/fallback, integração HTTP por idioma e teste
automático de paridade de chaves.

**Documentação:** convenção de chaves e idiomas suportados.

## PROT-006

### Consolidar API base, health e readiness

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Tipo         | Technical Story    |
| Prioridade   | P0                 |
| Dependências | PROT-003, PROT-004 |

**Objetivo:** criar a base Fastify versionada e separar processo vivo de
processo pronto para receber tráfego.

**Escopo:** `GET /health`, `GET /ready`, prefixo `/api/v1`, encerramento gracioso
e mecanismo extensível de probes para banco/Redis.

**Critérios de aceite:** `/health` retorna 200 e `{ "status": "ok" }` enquanto o
processo está vivo; `/ready` retorna 200 apenas com dependências obrigatórias
disponíveis e 503 sanitizado caso contrário; rotas de negócio ficam sob
`/api/v1`; SIGTERM fecha conexões e para de aceitar requests.

**Testes:** integração dos endpoints, probe indisponível e shutdown gracioso.

**Documentação:** catálogo base de rotas e significado dos probes.

## PROT-007

### Consolidar Swagger/OpenAPI

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Tipo         | Technical Story    |
| Prioridade   | P1                 |
| Dependências | PROT-004, PROT-006 |

**Objetivo:** fazer de `packages/schema` a fonte oficial dos contratos HTTP.

**Escopo:** body, params, querystring, responses, erros comuns, security schemes,
tags e geração OpenAPI; regra de revisão para impedir rota sem schema.

**Critérios de aceite:** documento OpenAPI válido é gerado; health/ready e erro
comum estão descritos; endpoints protegidos exibem security; nenhum segredo é
usado como exemplo.

**Testes:** validação estrutural do JSON OpenAPI, snapshots/contratos e acesso à
UI conforme política de ambiente.

**Documentação:** orientação de criação de schema e exposição do Swagger.

## PROT-008

### Implantar logging estruturado e seguro

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Tipo         | Technical Story    |
| Prioridade   | P0                 |
| Dependências | PROT-003, PROT-006 |

**Objetivo:** correlacionar requisições sem registrar dados sensíveis.

**Escopo:** `requestId`, `correlationId`, método, rota normalizada, status,
duração e contexto permitido; propagação API/worker; redaction; níveis por
ambiente.

**Critérios de aceite:** requestId é aceito/gerado e devolvido; logs são JSON;
rota usa template, não IDs sensíveis; denylist de segurança é redigida; falha de
serialização não derruba a aplicação.

**Testes:** captura de logs em sucesso/erro, propagação de correlação e suíte de
redaction com token, CPF, endereço, relato e coordenadas.

**Documentação:** campos permitidos/proibidos e consulta operacional.

## PROT-009

### Configurar Redis

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Tipo         | Technical Story    |
| Prioridade   | P0                 |
| Dependências | PROT-003, PROT-006 |

**Objetivo:** oferecer Redis compartilhado para rate limit, cache, locks e
filas.

**Escopo:** plugin, conexão/reconexão, timeouts, encerramento gracioso, serviço no
Compose e probe de readiness; namespace de chaves por ambiente.

**Critérios de aceite:** set/get e expiração funcionam; indisponibilidade é
identificada separadamente no readiness; segredos não aparecem em erro/log;
conexões são fechadas no shutdown.

**Testes:** integração real com Redis, expiração, indisponibilidade e retomada.

**Documentação:** uso permitido, convenção de chaves e operação local.

## PROT-010

### Criar infraestrutura do Worker

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Tipo         | Technical Story    |
| Prioridade   | P0                 |
| Dependências | PROT-001, PROT-009 |

**Objetivo:** processar trabalho assíncrono de forma observável e resiliente.

**Escopo:** filas `emergency`, `notifications`, `integrations`, `evidences` e
`risk`; queue/processor/use case; contrato base de job versionado; retry,
backoff, tentativas e falha controlada; shutdown gracioso.

**Regras:** jobs são idempotentes; payload minimiza dados sensíveis; nenhuma
regra de negócio vive no processor.

**Critérios de aceite:** worker aguarda jobs sem busy loop; job de teste percorre
fila e processor uma vez; falha transitória reexecuta conforme política; falha
terminal é observável; reinício não duplica efeito idempotente.

**Testes:** integração com Redis, retry/backoff com tempo reduzido, idempotência,
falha terminal e shutdown durante processamento.

**Documentação:** catálogo de filas, envelope do job e runbook inicial de falha.
