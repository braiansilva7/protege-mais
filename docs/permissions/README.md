# Permissões e escopos

## Convenção

Permissões usam `<recurso>.<ação>`, por exemplo `victim.view` e
`emergency_alert.resolve`. Código de papel não substitui verificação de
permissão.

## Contexto obrigatório

Uma decisão pode considerar conta, organização, unidade, recurso, vínculo e
modo excepcional. O mesmo usuário pode exercer papéis diferentes em
organizações diferentes.

## Catálogo inicial planejado

- `account.list/view/create/update/disable`;
- `organization.list/view/create/update`;
- `victim.list/view/create/update`;
- `case.list/view/create/update/close/transfer`;
- `aggressor.create/view/update`;
- `incident.create/view/update`;
- `protective_order.create/view/update`;
- `evidence.create/view/download`;
- `emergency_alert.view/assume/dispatch/resolve`;
- `risk_assessment.create/view/review`;
- `audit.view` e `report.view`.

O catálogo só se torna implementado com `PROT-017`, `PROT-018` e os tickets de
cada domínio.

## Matriz viva

Cada ticket deve acrescentar uma tabela com papel/contexto, permissão, recurso e
resultado esperado, cobrindo:

- autorizado;
- não autenticado;
- sem permissão;
- organização diferente;
- unidade diferente;
- vínculo inativo;
- break glass, quando permitido.
