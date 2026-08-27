# Registros de decisão arquitetural

Crie um ADR quando um ticket alterar tecnologia, fronteira entre camadas,
modelo de autorização, persistência, fila, contrato de evento, criptografia,
retenção ou comportamento de emergência.

## Nomenclatura

```text
ADR-NNN-titulo-curto.md
```

## Template

```md
# ADR-NNN — Título

Status: Proposto | Aceito | Substituído
Data: AAAA-MM-DD
Ticket: PROT-NNN

## Contexto

Problema e restrições.

## Decisão

Decisão adotada.

## Alternativas consideradas

Alternativas e motivos da rejeição.

## Consequências

Benefícios, custos, riscos e plano de reversão/migração.
```

ADR registra decisão; não substitui documentação operacional, contrato de API
ou registro de implementação.

## Decisões existentes

- [ADR-001 — BullMQ sobre Redis para filas do Worker](ADR-001-bullmq-redis-queues.md)
- [ADR-002 — Convenções de models e migrations](ADR-002-database-conventions.md)
- [ADR-003 — Enums nativos do PostgreSQL e fonte TypeScript única](ADR-003-native-postgresql-enums.md)
- [ADR-004 — Unicidade e reutilização de identificadores ativos](ADR-004-active-account-identifier-reuse.md)
