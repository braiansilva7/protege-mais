# ADR-002 — Convenções de models e migrations

Status: Aceito
Data: 2026-08-26
Ticket: PROT-013

## Contexto

Os models de domínio começam no `PROT-014`. Sem um contrato prévio, tabelas
criadas em tickets independentes poderiam divergir em nomes, geração de IDs,
precisão temporal, nulabilidade, integridade, concorrência e exclusão lógica.
Essas divergências são caras de corrigir depois que migrations entram em
ambientes persistentes.

O projeto também precisa provar que o model Drizzle e o histórico Atlas
representam o mesmo schema sem introduzir tabelas fictícias na produção nem
tornar seed um requisito estrutural.

## Decisão

- o banco usa `snake_case` e o TypeScript usa `camelCase`, com mapeamento
  explícito no model;
- IDs de entidades são `uuid`, gerados como UUID v7 pela aplicação, sem default
  UUID no banco;
- instantes usam `TIMESTAMPTZ(3)` e sessões operam em UTC;
- nulabilidade, defaults, constraints, FKs e índices são deliberados; objetos
  recebem nomes determinísticos e toda FK declara `ON UPDATE` e `ON DELETE`;
- tabelas mutáveis adotam optimistic locking com `version` inteiro positivo
  como baseline; casos que exigem lock ou isolamento mais forte documentam a
  exceção no ticket consumidor;
- soft delete é opt-in. `audit_logs`, `alert_events` e `risk_assessments` não o
  recebem automaticamente;
- migrations de produção são forward-only, independentes de seed e corrigidas
  por migration compensatória quando necessário;
- helpers comuns ficam na fronteira pública de `packages/models`; um fixture
  Drizzle/Atlas separado valida as convenções, mas não é exportado pelo schema
  de produção e seu ambiente Atlas não possui URL de deploy.

O contrato operacional completo e as exceções estão em
`docs/database/CONVENTIONS.md` e `docs/database/MIGRATION_CHECKLIST.md`.

## Alternativas consideradas

- gerar UUID no banco: rejeitado porque criaria duas fontes de geração e
  impediria que a aplicação conhecesse o identificador antes da persistência;
- usar `updated_at` como token concorrente: rejeitado porque precisão de tempo e
  ordem de escrita não formam um contador inequívoco;
- aplicar soft delete a todas as tabelas: rejeitado porque exclusão, retenção,
  correção e imutabilidade têm semânticas diferentes por domínio;
- manter tabelas-exemplo no schema principal: rejeitado porque produziria
  objetos sem finalidade de negócio em todos os ambientes;
- depender apenas de exemplos documentais: rejeitado porque não comprovaria o
  DDL efetivamente exportado nem detectaria drift.

## Consequências

Tickets de dados ganham helpers e um checklist comum, e revisões podem comparar
model, SQL e comportamento real de forma determinística. A aplicação assume a
responsabilidade de gerar IDs e manter `updated_at` em escritas fora do fluxo
Drizzle. Optimistic locking exige tratar zero linhas atualizadas como conflito.
Soft delete, retenção e recuperação continuam decisões explícitas de cada
entidade.

Mudar uma convenção depois do primeiro schema persistido exige novo ADR,
migration compatível e estratégia de transição; migrations já aplicadas não são
reescritas.
