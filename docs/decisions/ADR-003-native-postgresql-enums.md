# ADR-003 — Enums nativos do PostgreSQL e fonte TypeScript única

Status: Aceito
Data: 2026-08-26
Ticket: PROT-014

## Contexto

Os próximos tickets precisam compartilhar tipos e status entre aplicação,
models Drizzle e PostgreSQL. Arrays duplicados ou colunas de texto permitiriam
drift e valores inválidos. Ao mesmo tempo, enums nativos possuem evolução mais
restrita: labels existentes não podem ser removidos ou reordenados diretamente.

O catálogo inicial deve preparar os contratos sem criar tabelas, defaults,
permissões ou máquinas de estado dos tickets consumidores.

## Decisão

- conjuntos fundamentais e estáveis usam tipos enum nativos no schema `public`;
- nomes e labels usam inglês em `snake_case`, são case-sensitive e não são
  textos de interface;
- tuples literais imutáveis em `packages/common/enums` são a fonte dos values e
  dos literal union types TypeScript;
- `packages/models/enums.ts` cria um `pgEnum` por conceito reutilizando a mesma
  tuple; tipos semanticamente diferentes continuam separados mesmo quando
  compartilham labels;
- nenhum enum possui default ou tabela consumidora neste ticket;
- a ordem física dos labels não representa prioridade nem transição de negócio;
- adição usa nova migration forward e deploy de banco antes do produtor do
  valor; remoção, reorder ou mudança incompatível usa tipo substituto,
  mapeamento de dados e expand/contract;
- cada mudança comprova paridade entre tuple, `pgEnum`, migration e catálogo
  real do PostgreSQL.

## Alternativas consideradas

- `text` com validação apenas na aplicação: rejeitado porque escritas
  concorrentes, SQL e integrações poderiam persistir valores fora do contrato;
- `text` com `CHECK`: oferece evolução mais flexível, mas duplica o conjunto entre
  constraint e TypeScript e perde tipos PostgreSQL distintos por conceito;
- `enum` TypeScript separado do `pgEnum`: rejeitado porque cria duas listas que
  podem divergir;
- um enum genérico compartilhado para todos os status ou níveis: rejeitado
  porque conceitos diferentes evoluem independentemente e não devem ser
  comparáveis por acidente;
- gerar TypeScript por introspecção no runtime: rejeitado porque torna o build
  dependente de banco e desloca a divergência para o deploy.

## Consequências

O banco rejeita labels inválidos e consumidores TypeScript recebem unions
literais sem manter cópias locais. Os tipos existem antes das tabelas e não
alteram nenhum fluxo funcional.

Adicionar um label é simples, mas renomear ou remover exige planejamento de
compatibilidade e migration estrutural. Aplicativos não podem usar ordinal do
enum como regra. O catálogo semântico precisa ser atualizado junto com cada
evolução.
