# Checklist de migration

Use este checklist em toda alteração estrutural. Um item não aplicável deve ser
justificado na revisão do ticket; não deve ser ignorado silenciosamente.

## Antes de gerar

- [ ] O ticket e todas as dependências estão concluídos ou em execução válida.
- [ ] O model usa tabela/colunas `snake_case` e propriedades `camelCase`.
- [ ] IDs usam `uuid` com UUID v7 gerado pela aplicação, sem default UUID no
      banco.
- [ ] Instantes usam `TIMESTAMPTZ(3)` e a nulabilidade de cada coluna é
      deliberada.
- [ ] FKs, unique/check constraints e índices seguem nomes explícitos do guia.
- [ ] Ações `ON UPDATE` e `ON DELETE` estão declaradas e preservam histórico.
- [ ] A estratégia de concorrência está definida; tabela mutável usa `version`
      ou documenta por que precisa de outra técnica.
- [ ] Soft delete é opt-in; filtro, restauração e reutilização de chaves únicas
      estão definidos.
- [ ] `audit_logs`, `alert_events` e `risk_assessments` não receberam soft
      delete automático.

## Revisão do SQL gerado

- [ ] Gere o diff estrutural em `prod` e leia todo o arquivo SQL.
- [ ] O nome segue `<timestamp_UTC>_<descricao_snake_case>.sql`.
- [ ] A migration não referencia `atlas/seed`, fixtures ou dados obrigatórios.
- [ ] Não há drop, truncate, cast com perda, backfill implícito ou default
      perigoso não planejado.
- [ ] Constraints e índices correspondem ao model e não duplicam estruturas.
- [ ] Locks, duração, volume e compatibilidade com a versão anterior da
      aplicação foram avaliados.
- [ ] Mudanças destrutivas usam expand/backfill/contract e possuem recuperação
      ou migration compensatória definida.
- [ ] O SQL não contém segredo, PII, dado sensível ou coordenada real.
- [ ] Uma edição deliberada foi seguida por `atlas migrate hash`; apply nunca
      recalcula checksum.

## Validação reproduzível

- [ ] `ENV=prod pnpm atlas:validate:docker` valida arquivos e checksum.
- [ ] Uma base criada de `template0` aceita todas as migrations sem seed.
- [ ] `pnpm migrate:local` aplica a estrutura e uma segunda execução tem zero
      pendências.
- [ ] `ENV=prod pnpm atlas:status:docker` informa a versão esperada.
- [ ] `ENV=prod pnpm atlas:diff:docker` retorna zero drift.
- [ ] Testes de constraints cobrem sucesso, `NOT NULL`, FK, unicidade, check e
      concorrência relevantes.
- [ ] Queries justificadoras de novos índices foram verificadas com plano
      representativo quando aplicável.
- [ ] Forward e recuperação foram exercitados conforme a estratégia do ticket;
      nenhuma base ou volume não reservado foi removido.

## Qualidade e entrega

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` e
      `pnpm build` passam.
- [ ] Integrações reais afetadas passam contra os serviços do Compose.
- [ ] Models, migration, repositories e contratos usam os mesmos nomes e
      semântica.
- [ ] Guia de banco, arquitetura atual, ticket e changelog foram atualizados.
- [ ] Decisão estrutural nova possui ADR.
- [ ] Seeds continuam opcionais, fictícios, idempotentes e separados da
      estrutura.

---

Documentação Protege Mais — Checklist de migration
