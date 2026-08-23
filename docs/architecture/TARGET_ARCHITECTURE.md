# Arquitetura-alvo do Protege Mais

## Status

Este documento descreve a arquitetura aprovada a ser alcançada pelos tickets.
Ele não afirma que todos os componentes já estejam implementados. O estado
atual deve ser consultado em `docs/PROJECT_ARCHITECTURE.md`.

## Regras invariáveis

- Controller adapta HTTP e não contém regra de negócio.
- Repository persiste dados e não toma decisão de negócio ou autorização.
- Use case orquestra regras, autorização contextual, persistência e eventos.
- Page e Screen não acessam API, storage ou segredo diretamente.
- Permissão nunca existe somente no frontend.
- Integrações lentas ou instáveis não bloqueiam a resposta de emergência.
- Mensagens de negócio não ficam hardcoded em controller ou use case.

## Estrutura-alvo

```text
protege-mais/
├── apps/
│   ├── manager_api/     # Entrada HTTP administrativa e institucional
│   ├── worker/          # Jobs de emergência, notificação e integração
│   ├── web/             # Operação institucional
│   └── mobile/          # Aplicativo da pessoa protegida
├── packages/
│   ├── common/          # Enums, permissões, erros, constantes e tipos
│   ├── config/          # Configuração validada e centralizada
│   ├── interfaces/      # Entradas compartilhadas dos casos de uso
│   ├── middlewares/     # Auth, autorização, escopo, auditoria e break glass
│   ├── models/          # Models Drizzle
│   ├── plugins/         # Banco, Redis, filas, S3, criptografia e i18n
│   ├── repositories/    # Persistência por domínio
│   ├── schema/          # Contratos HTTP e OpenAPI
│   ├── services/        # Serviços reutilizáveis
│   └── useCases/        # Orquestração da regra de negócio
├── atlas/
│   ├── prod/            # Migrations de estrutura
│   └── seed/dev/        # Dados exclusivos de desenvolvimento
└── docs/
```

## Fluxo Web

```text
Page → Component → Composable → Route/Schema/Auth/Permission
     → Controller → UseCase → Service/Repository → PostgreSQL
```

Page coordena o fluxo visual. Component recebe propriedades e emite eventos.
Composable concentra URL, token, locale, loading e tratamento de erro.

## Fluxo Mobile

```text
Screen → Service ┬→ API → Backend
                 └→ Storage seguro
```

A Screen não conhece URL, JWT, cliente HTTP, armazenamento persistente nem
detalhes de integração externa.

## Fluxo de emergência

```text
Mobile → POST /api/v1/emergency-alerts
       → Controller → UseCase → transação no PostgreSQL → publicação na fila
       → resposta imediata

Worker → consome job → notifica central/push/SMS/integração
       → registra eventos → retry/backoff → falha controlada/DLQ
```

O contrato entre gravação e publicação deve evitar alertas persistidos sem job
e jobs sem alerta correspondente. A técnica concreta, como outbox
transacional, será registrada por ADR no ticket que implementar o fluxo.

## Responsabilidade das camadas

| Camada                | Pode fazer                                             | Não pode fazer                         |
| --------------------- | ------------------------------------------------------ | -------------------------------------- |
| Route                 | Método, URL, schema e middlewares                      | Regra de negócio ou SQL                |
| Controller            | Adaptar request/reply e chamar use case                | Consultar Drizzle ou decidir acesso    |
| Use case              | Orquestrar regra, autorização, serviços e repositórios | Conhecer detalhes de HTTP              |
| Service               | Encapsular capacidade reutilizável                     | Misturar transporte e interface visual |
| Repository            | Consultar e persistir                                  | Autorizar usuário ou decidir regra     |
| Model                 | Mapear schema Drizzle                                  | Executar fluxo de aplicação            |
| Composable/API Mobile | Comunicar com backend e tipar resposta                 | Renderizar regra visual                |
| Page/Screen           | Coordenar UI                                           | Chamar HTTP/storage diretamente        |
| Worker                | Processar jobs idempotentes                            | Depender de request HTTP aberto        |

## Domínios-alvo

Identidade e instituição: accounts, auth sessions, roles, permissions,
organizations, units e memberships.

Proteção: victims, cases, aggressors, incidents, protective orders, evidences,
support contacts, risk assessments, safety plans e referrals.

Emergência e comunicação: emergency alerts, alert events, location sessions,
location points, notifications, audit e integrations.

## Banco e migrations

- PostgreSQL com UTC, UUID e `TIMESTAMPTZ`.
- PostGIS para dados geoespaciais.
- Banco em `snake_case` e TypeScript em `camelCase`.
- Soft delete somente quando a semântica permitir.
- Histórico como audit logs, alert events e risk assessments não usa exclusão
  lógica automática.
- Migrations Atlas são estruturais e não dependem de seed.
- Seeds contêm apenas dados e devem ser seguros para desenvolvimento.

## Internacionalização

Backend, Web e Mobile mantêm `pt-BR`, `en` e `es`. Chaves são equivalentes nos
três idiomas e contratos de erro expõem código estável, mensagem traduzível e
`requestId`.

## Evolução desta arquitetura

Mudança de responsabilidade entre camadas, tecnologia de persistência,
autenticação, filas, criptografia, escopo de autorização ou tratamento de
emergência exige ADR. A conclusão de cada ticket deve atualizar este documento
somente quando o código efetivamente alcançar a arquitetura descrita.
