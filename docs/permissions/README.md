# Permissões e escopos

## Estado atual

Nenhum papel, permissão, atribuição ou middleware de autorização está
implementado após `PROT-000`. As estruturas do template foram removidas para não
serem confundidas com o modelo contextual aprovado.

## Convenção futura

Permissões usarão `<recurso>.<ação>`, por exemplo `victim.view` e
`emergency_alert.resolve`. Código de papel não substituirá verificação de
permissão.

Uma decisão poderá considerar conta, organização, unidade, recurso, vínculo e
modo excepcional. O mesmo usuário poderá exercer papéis diferentes em
organizações diferentes.

## Tickets responsáveis

- `PROT-017`: tabelas de roles e permissions;
- `PROT-018`: seed inicial do catálogo;
- `PROT-030`: middleware de permissão;
- `PROT-031` e `PROT-032`: escopos organizacional e de unidade;
- `PROT-034`: acesso excepcional break glass.

Nenhum código anterior a esses tickets deve introduzir verificações fixas como
`role === 'ADMIN'`.

## Matriz viva futura

Cada ticket de domínio deverá registrar cenários autorizado, não autenticado,
sem permissão, organização diferente, unidade diferente, vínculo inativo e
break glass quando permitido.
