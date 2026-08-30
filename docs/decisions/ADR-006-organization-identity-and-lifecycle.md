# ADR-006 — Identidade institucional e ciclo de vida de organizações

Status: Aceito
Data: 2026-08-30
Ticket: PROT-019

## Contexto

`organizations` precisa identificar uma instituição sem ambiguidade, manter
histórico após soft delete e servir de contexto para RBAC. O CNPJ é a chave
institucional do escopo inicial, mas seu formato mudou: desde julho de 2026 a
Receita Federal emite também CNPJs alfanuméricos, enquanto os numéricos anteriores
continuam válidos. Os dois formatos mantêm 14 posições e dígitos verificadores
por módulo 11.

Também era necessário decidir se soft delete liberaria o CNPJ. Ao contrário de
um e-mail de login, o identificador institucional representa a mesma pessoa
jurídica e ancora relações históricas. Permitir uma segunda linha com o mesmo
CNPJ fragmentaria ownership, unidades, memberships e atribuições.

Referências oficiais consultadas:

- [Receita Federal — CNPJ Alfanumérico](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico);
- [Receita Federal — primeiro CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-gera-o-primeiro-cnpj-em-formato-alfanumerico).

## Decisão

- persistir o CNPJ canônico sem máscara em `varchar(14)`, com letras maiúsculas;
- aceitar `0-9` e `A-Z` nas 12 primeiras posições e somente dígitos nas duas
  posições verificadoras;
- validar formato e módulo 11 no helper TypeScript e em checks nomeados do
  PostgreSQL, usando o valor `ASCII - 48` definido para o formato alfanumérico;
- manter `UNIQUE (cnpj)` global, sem predicado de soft delete;
- restaurar a linha original quando a instituição voltar a operar; nunca criar
  outra identidade com o mesmo CNPJ;
- derivar operacionalidade de `is_active AND deleted_at IS NULL`;
- manter `integration_enabled` como configuração independente que nunca
  sobrepõe inatividade ou exclusão;
- referenciar a organização por FK restritiva em `account_roles`, sem usar
  trigger para decidir elegibilidade funcional.

## Alternativas consideradas

- Aceitar somente 14 dígitos: rejeitado porque excluiria novos CNPJs oficiais
  já emitidos em 2026.
- Manter a máscara: rejeitado porque pontuação é apresentação e permitiria
  representações diferentes da mesma identidade.
- Validar apenas na aplicação: rejeitado porque SQL, integrações e concorrência
  poderiam persistir formato ou dígitos verificadores inválidos.
- Usar unicidade parcial em registros não excluídos: rejeitado porque o CNPJ não
  é uma credencial reutilizável e a segunda linha dividiria histórico da mesma
  instituição.
- Impedir contexto inativo por trigger: rejeitado porque criaria regra funcional
  não representada pelo model declarativo e não validaria membership. O runtime
  futuro precisa avaliar organização, vínculo, papel e permissão em conjunto.

## Consequências

CNPJs numéricos e alfanuméricos coexistem no mesmo contrato e conflitos são
arbitrados atomicamente pelo banco. A expressão declarativa dos dígitos
verificadores torna a migration maior, mas evita função ou trigger fora do
estado Drizzle/Atlas.

Soft delete preserva a reserva do CNPJ. Uma instituição removida por engano
precisa ser restaurada com controle de versão; uma nova linha recebe outro CNPJ.
Mudar essa regra exige migration, análise das referências existentes e novo ADR.

A FK impede organização inexistente e hard delete referenciado, mas não torna
RBAC funcional. `PROT-021`, `PROT-030` e `PROT-031` ainda precisam validar
membership, atividade e escopo antes de autorizar qualquer operação.
