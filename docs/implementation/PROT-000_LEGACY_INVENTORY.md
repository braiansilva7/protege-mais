# PROT-000 — Inventário do legado

## Objetivo

Registrar a decisão de manter, adaptar ou remover cada grupo herdado antes do
saneamento. Este inventário descreve o baseline do commit anterior ao
`PROT-000` e serve como evidência da remoção controlada.

## Manter

| Grupo                                              | Motivo                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Configuração do monorepo, pnpm, Turbo e TypeScript | Fundação técnica independente de domínio                                 |
| Fastify e rota `GET /health`                       | Shell mínimo verificável da API                                          |
| CORS, i18n e Swagger                               | Plugins genéricos necessários aos próximos tickets                       |
| PostgreSQL, Drizzle e integração Atlas             | Infraestrutura genérica; o schema ficará vazio até PROT-011              |
| Multipart e MinIO local                            | Capacidade genérica prevista para evidências, ainda sem regra de negócio |
| UUID v7                                            | Convenção aprovada para identificadores futuros                          |
| Vue, Vuetify e i18n Web                            | Shell visual mínimo                                                      |
| Expo/React Native                                  | Shell Mobile mínimo, sem fluxo funcional                                 |
| Documentação, roadmap e backlog                    | Fonte de verdade da transição                                            |

## Adaptar

| Grupo                         | Adaptação                                                              |
| ----------------------------- | ---------------------------------------------------------------------- |
| Bootstrap da API              | Remover JWT, autenticação e rotas de negócio herdadas                  |
| Build da API                  | Limpar `dist` antes de compilar para não preservar artefatos removidos |
| Agregador `/api/v1`           | Permanecer vazio como ponto de extensão                                |
| Tipos Fastify                 | Manter apenas banco e tradução, sem usuário/permissão                  |
| Swagger                       | Documentar somente a saúde da aplicação neste baseline                 |
| Configuração de ambiente      | Remover segredos JWT e S3 consumidos por fluxos legados                |
| Export de models              | Tornar o schema Drizzle explicitamente vazio                           |
| Catálogos de tradução backend | Remover mensagens de autenticação/usuário/papel                        |
| Web                           | Substituir login/dashboard/usuários por página estática de fundação    |
| Mobile                        | Remover o texto que identifica o produto como jogo                     |
| Compose                       | API deixa de depender de MinIO enquanto não há recurso de storage      |

## Remover

| Grupo                   | Itens                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Models e SQL de jogo    | country, user, category, question, answer, player, game, joker e score               |
| Autorização herdada     | permission roles, assignments, catálogo `users.*`/`roles.*` e JWT atual              |
| API de negócio herdada  | login/me, users e permission-roles                                                   |
| Camadas dependentes     | controllers, schemas, interfaces, repositories, services e use cases desses domínios |
| Upload de avatar        | interface e storage service dedicados a profile picture                              |
| Web de negócio herdado  | login, dashboard, usuários, papéis, navegação, composable e tipos associados         |
| Migrations e seeds      | todos os arquivos SQL e checksums que recriam o schema anterior                      |
| Dependências exclusivas | AWS SDK e Fastify JWT até seus tickets próprios                                      |

## Fora do escopo preservado

- Não criar `accounts`, roles/permissions novos ou autenticação substituta.
- Não criar worker, Redis, PostGIS ou `/ready`.
- Não redesenhar plugins genéricos; isso pertence aos tickets seguintes.
- Não aplicar migrations nem recriar volumes de banco.

## Recuperação

Os arquivos removidos continuam recuperáveis pelo histórico Git. O banco local
já não possuía volumes PostgreSQL antes deste ticket, portanto não houve nova
exclusão de dados externos durante o saneamento.
