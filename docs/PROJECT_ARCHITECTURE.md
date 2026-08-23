# Arquitetura atual do Protege Mais

## Estado

Este documento registra somente o que existe após o `PROT-000`. A arquitetura
futura permanece em `docs/architecture/TARGET_ARCHITECTURE.md` e não deve ser
confundida com funcionalidade já entregue.

O baseline atual não possui domínio de negócio, autenticação, autorização,
tabelas, migrations ou seeds. Os shells compiláveis permitem evoluir uma etapa
por vez sem dependências do template anterior.

## Estrutura executável atual

```text
protege-mais/
├── apps/
│   ├── manager_api/
│   │   └── src/
│   │       ├── controllers/health/
│   │       ├── plugins/swagger/
│   │       ├── routes/
│   │       ├── types/
│   │       └── server.ts
│   ├── web/
│   │   └── src/
│   │       ├── assets/styles/
│   │       ├── plugins/i18n/
│   │       ├── App.vue
│   │       └── main.ts
│   └── mobile/
│       ├── App.tsx
│       └── index.ts
├── packages/
│   ├── common/
│   │   ├── enums/ETagSwagger.ts
│   │   └── functions/uuid.ts
│   ├── config/environments.ts
│   ├── models/index.ts
│   ├── plugins/
│   │   ├── database/
│   │   ├── i18next/
│   │   ├── cors.ts
│   │   └── multipart/
│   └── schema/health/
├── atlas/
│   ├── prod/                 # vazio
│   └── seed/dev/             # vazio
└── docs/
```

O `apps/worker` e a consolidação dos packages-alvo pertencem ao `PROT-001`.

## API

O bootstrap Fastify registra, nesta ordem:

1. pool PostgreSQL/Drizzle;
2. parser multipart;
3. CORS;
4. i18n;
5. Swagger;
6. `GET /health`;
7. agregador vazio sob `/api/v1`.

Não há JWT, middleware de autenticação, usuário autenticado ou permissão no
baseline. Esses componentes serão redesenhados em seus tickets próprios.

## Web

O Web contém uma página estática traduzida informando que a fundação está em
preparação. Não chama API, não persiste token e não oferece login, dashboard ou
cadastro.

## Mobile

O Mobile contém somente o shell Expo/React Native. Não chama API, storage ou
serviços externos e não possui fluxo funcional.

## Banco e Atlas

`packages/models/index.ts` exporta um schema vazio. `atlas/prod` e
`atlas/seed/dev` não contêm SQL nem checksums legados. Portanto, nenhum comando
de migration ou seed consegue recriar tabelas do produto anterior.

A integração PostgreSQL/Drizzle foi mantida como infraestrutura genérica. Sua
configuração oficial, conexão verificada, migrations iniciais e convenções
serão entregues por `PROT-011` a `PROT-013`.

## Capacidades genéricas preservadas

- UUID v7 gerado pela aplicação;
- CORS;
- internacionalização backend e Web em estrutura `pt`, `en` e `es`;
- Swagger/OpenAPI da rota de saúde;
- multipart com limite básico;
- PostgreSQL, Drizzle, Atlas e MinIO no ambiente local.

Essas capacidades ainda poderão ser consolidadas ou substituídas pelos tickets
de fundação. Preservação não significa que estejam homologadas para produção.

## Inventário e recuperação

A classificação completa do legado está em
`docs/implementation/PROT-000_LEGACY_INVENTORY.md`. Os arquivos removidos são
recuperáveis pelo histórico Git; nenhum volume PostgreSQL foi criado ou apagado
durante este ticket.

---

Documentação Protege Mais — Arquitetura atual
