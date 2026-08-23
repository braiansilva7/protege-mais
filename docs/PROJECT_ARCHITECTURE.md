# Arquitetura do projeto — Protege Mais

## Objetivo

Este documento registra a organização de pastas e o modelo de dados atual do
Protege Mais. Deve ser consultado antes de criar domínios, rotas, telas,
models, migrations ou recursos de autorização.

## Estrutura de pastas

```text
protege-mais/
├── apps/
│   ├── manager_api/
│   │   └── src/
│   │       ├── controllers/       # Adaptadores HTTP por domínio
│   │       ├── permissions/       # Ações exigidas por rota
│   │       ├── plugins/           # Swagger e integrações da API
│   │       ├── routes/            # Registro de endpoints Fastify
│   │       └── types/             # Extensões dos tipos Fastify/JWT
│   ├── web/
│   │   └── src/
│   │       ├── assets/
│   │       │   ├── images/
│   │       │   │   ├── avatars/
│   │       │   │   ├── brand/
│   │       │   │   ├── cards/
│   │       │   │   ├── icons/payments/
│   │       │   │   ├── illustrations/
│   │       │   │   ├── misc/
│   │       │   │   ├── pages/
│   │       │   │   └── svg/
│   │       │   └── styles/variables/
│   │       ├── components/        # Componentes por domínio
│   │       ├── composables/       # Estado e acesso HTTP reutilizável
│   │       ├── layouts/           # Estrutura visual compartilhada
│   │       ├── navigation/        # Itens vertical e horizontal
│   │       ├── pages/             # Páginas de negócio
│   │       ├── plugins/i18n/      # Configuração e traduções web
│   │       ├── types/             # Contratos TypeScript
│   │       └── utils/             # Funções puras e formatadores
│   └── mobile/
├── packages/
│   ├── common/                    # Enums, tipos e funções comuns
│   ├── config/                    # Leitura e validação de ambiente
│   ├── interfaces/                # Interfaces de entrada compartilhadas
│   ├── middlewares/               # JWT e autorização
│   ├── models/                    # Definição Drizzle das tabelas
│   ├── plugins/                   # Banco, i18n, S3, CORS e multipart
│   ├── repositories/              # Persistência por domínio
│   ├── schema/                    # Contratos Fastify e Swagger
│   ├── services/                  # Regras reutilizáveis de domínio
│   └── useCases/                  # Casos de uso por operação
├── atlas/
│   ├── prod/                      # Migrations de estrutura
│   └── seed/dev/                  # Dados de desenvolvimento
└── docs/
```

## Fluxo de uma rota

```text
Web Page/Component
        │
        ▼
Composable → /api/v1/... → Route → Controller → Use case → Service/Repository → Banco
                                      │
                                      ├── Schema Fastify/Swagger
                                      └── Middleware de permissão
```

As interfaces ficam em `packages/interfaces`; schemas em
`packages/schema`; mensagens visíveis devem estar nos arquivos de tradução
`pt`, `en` e `es` do backend e do web.

## Modelo de dados

```mermaid
erDiagram
  COUNTRIES ||--o{ USERS : "country_id"
  USERS ||--|| PERMISSION_ASSIGNMENTS : "user_id"
  PERMISSION_ROLES ||--o{ PERMISSION_ASSIGNMENTS : "permission_role_id"
  PERMISSION_ROLES ||--o{ PERMISSION_ROLE_ACTIONS : "permission_role_id"
  PERMISSIONS ||--o{ PERMISSION_ROLE_ACTIONS : "action"

  USERS ||--o| PLAYER_PROGRESS : "user_id"
  USERS ||--o{ GAME_SESSIONS : "user_id"
  USERS ||--o{ QUESTIONS : "created_by_user_id"
  CATEGORIES ||--o{ QUESTIONS : "category_id"
  QUESTIONS ||--o{ QUESTION_TRANSLATIONS : "question_id"
  QUESTIONS ||--o{ ANSWER_OPTIONS : "question_id"
  ANSWER_OPTIONS ||--o{ ANSWER_OPTION_TRANSLATIONS : "answer_option_id"
  GAME_SESSIONS ||--o{ SESSION_QUESTIONS : "game_session_id"
  QUESTIONS ||--o{ SESSION_QUESTIONS : "question_id"
  ANSWER_OPTIONS ||--o{ SESSION_QUESTIONS : "selected_answer_option_id"
  GAME_SESSIONS ||--o{ SESSION_JOKERS : "game_session_id"
  JOKER_TYPES ||--o{ SESSION_JOKERS : "joker_type_id"
  SESSION_QUESTIONS ||--o{ JOKER_USAGES : "session_question_id"
  JOKER_TYPES ||--o{ JOKER_USAGES : "joker_type_id"
  JOKER_USAGES ||--o{ JOKER_ELIMINATED_OPTIONS : "joker_usage_id"
  ANSWER_OPTIONS ||--o{ JOKER_ELIMINATED_OPTIONS : "answer_option_id"
  USERS ||--o{ SCORE_EVENTS : "user_id"
  GAME_SESSIONS ||--o{ SCORE_EVENTS : "game_session_id"
  SESSION_QUESTIONS ||--o{ SCORE_EVENTS : "session_question_id"

  COUNTRIES {
    uuid id PK
    varchar iso_code UK
    varchar name
  }
  USERS {
    uuid id PK
    varchar username UK
    varchar email UK
    uuid country_id FK
    varchar language_code
    boolean active
  }
  PERMISSION_ROLES {
    uuid id PK
    varchar code UK
    varchar name UK
    boolean is_system
    boolean active
  }
  PERMISSIONS {
    varchar action PK
  }
  PERMISSION_ROLE_ACTIONS {
    uuid permission_role_id FK
    varchar action FK
  }
  PERMISSION_ASSIGNMENTS {
    uuid user_id PK, FK
    uuid permission_role_id FK
  }
  CATEGORIES {
    uuid id PK
    varchar name UK
  }
  QUESTIONS {
    uuid id PK
    uuid category_id FK
    uuid created_by_user_id FK
    varchar status
  }
  ANSWER_OPTIONS {
    uuid id PK
    uuid question_id FK
    smallint position
    boolean is_correct
  }
  GAME_SESSIONS {
    uuid id PK
    uuid user_id FK
    varchar status
  }
  SESSION_QUESTIONS {
    uuid id PK
    uuid game_session_id FK
    uuid question_id FK
  }
```

## Permissões

O acesso não depende de `ADMIN` ou `PLAYER` fixos no usuário. Cada usuário
possui uma atribuição em `permission_assignments`, vinculada a um papel em
`permission_roles`. As ações do papel são definidas por
`permission_role_actions`.

Catálogo inicial:

- `dashboard.view`
- `users.view`, `users.create`, `users.update`, `users.delete`
- `roles.view`, `roles.create`, `roles.update`, `roles.delete`,
  `roles.permissions`

Os papéis de sistema são Administrador e Jogador. Eles são protegidos contra
remoção e alteração.

## UUIDs e migrations

Todos os identificadores criados pela aplicação devem usar UUID v7, por meio de
`createUuidV7()` em `packages/common/functions/uuid.ts`. Seeds também devem
usar UUID v7 estático válido. Nunca introduzir `uuid.v4` ou
`gen_random_uuid()` em novos models, repositórios ou seeds.

Após alterar a estrutura:

```bash
pnpm migrate:local
# Para recriar a base local e reaplicar seeds:
pnpm seed:local
```

---

Documentação Protege Mais — Arquitetura e banco de dados
