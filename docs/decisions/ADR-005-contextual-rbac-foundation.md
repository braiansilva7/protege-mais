# ADR-005 — Fundação de RBAC contextual

Status: Aceito
Data: 2026-08-26
Ticket: PROT-017

## Contexto

O sistema precisa permitir que uma conta exerça papéis diferentes em
organizações e unidades distintas, sem fixar um papel diretamente em
`accounts`. O catálogo inicial, as entidades de organização/unidade, os
vínculos e o middleware de autorização pertencem a tickets posteriores.

O schema deste ticket precisa, portanto, representar o modelo completo o
suficiente para impedir duplicidades e escopos incoerentes, mas não pode criar
dependências para tabelas que ainda não existem nem antecipar regras funcionais
de autorização.

## Decisão

Adotamos RBAC com catálogos globais de papéis e permissões e duas relações N:N:

- `role_permissions` associa permissões a papéis;
- `account_roles` associa uma conta e um papel a um contexto opcional.

O contexto pertence à atribuição, não ao catálogo do papel. Ele pode ser global,
organizacional ou de unidade; uma unidade sempre exige uma organização. Os
UUIDs de organização e unidade ficam inicialmente sem FKs e receberão
referências por migrations futuras quando `PROT-019` e `PROT-020` criarem as
tabelas de destino.

A unicidade contextual usa `UNIQUE NULLS NOT DISTINCT`, tratando valores nulos
como iguais e rejeitando também atribuições globais duplicadas. Permissões usam
o formato exato `<recurso>.<ação>`.

Papéis de sistema são sempre ativos. As mutações suportadas filtram
`is_system = false` e usam a versão esperada; alterações de suas permissões
também precisam rejeitar papéis de sistema. Relações são imutáveis e as FKs já
existentes usam `ON DELETE RESTRICT`.

Índices cobrem a resolução por conta/contexto, o caminho inverso de papel e o
caminho inverso de permissão. A consulta de uma unidade herda atribuições
globais e da organização, mas descarta papéis inativos.

## Alternativas consideradas

- Duplicar cada papel por organização: mistura catálogo com atribuição, aumenta
  deriva e dificulta a evolução das permissões.
- Atribuir permissões diretamente à conta: perde a composição e a governança
  proporcionadas por papéis.
- Usar um UUID sentinela para representar escopo global: cria uma identidade
  artificial e mascara a nulabilidade semântica.
- Antecipar tabelas de organização/unidade ou adiar todos os campos de contexto:
  ambos deslocam escopo entre tickets e tornam a migration menos independente.
- Proteger papéis de sistema com trigger: o trigger não seria representado pelo
  schema declarativo Drizzle e introduziria drift no fluxo Atlas. Operações
  administrativas fora da aplicação ficam restritas ao fluxo controlado de
  migration/manutenção.

## Consequências

Uma mesma conta pode receber o mesmo papel em organizações diferentes, enquanto
duplicidades no mesmo contexto são rejeitadas pelo banco. Exclusões
referenciadas falham de forma determinística e a consulta contextual possui um
caminho indexado.

Ainda não existe autorização funcional. Antes de usar o modelo em runtime, os
tickets futuros devem criar e referenciar organizações/unidades, validar o
vínculo ativo e implementar o middleware. O `PROT-018` populará os catálogos sem
acoplar seed à migration de produção.

Hierarquia de papéis, segregação de funções, cache, auditoria de mutações e
break glass permanecem decisões posteriores. Se proteção também contra SQL
administrativo arbitrário se tornar requisito, ela deverá ser adicionada em
uma migration explícita e refletida nas fontes declarativas.
