# ADR-004 — Unicidade e reutilização de identificadores ativos

Status: Aceito
Data: 2026-08-26
Ticket: PROT-015

## Contexto

E-mail normalizado, telefone E.164 e o par provider/subject precisam localizar
uma identidade sem ambiguidade e resistir a criações concorrentes. `accounts`
também preserva linhas por soft delete, portanto unicidade global impediria a
reutilização indefinidamente, enquanto liberar identificadores sem uma regra
explícita criaria risco de restauração ambígua.

O banco deve ser a garantia final. Uma consulta prévia seguida de insert não é
atômica e duas instâncias podem observar simultaneamente a ausência da conta.

## Decisão

- e-mail normalizado, telefone E.164 e `(external_provider, external_subject)`
  usam índices únicos parciais com predicado `deleted_at IS NULL`;
- o e-mail é normalizado de forma determinística com trim e lowercase antes do
  insert, e um check preserva a paridade entre original e normalizado;
- identificadores podem ser reivindicados por outra conta depois do soft
  delete da conta anterior;
- a linha excluída, seu UUID e suas futuras referências históricas permanecem
  distintos; não há merge nem transferência automática de histórico;
- restaurar uma conta é uma operação explícita. Se um identificador tiver sido
  reutilizado, a restauração falha por conflito e exige resolução administrativa
  futura;
- toda busca e mutação por identificador ativo inclui `deleted_at IS NULL` e
  pode usar os índices parciais;
- conflitos são reconhecidos por SQLSTATE `23505` e pelo nome do índice. A
  aplicação não propaga mensagem ou detail do PostgreSQL, que podem conter
  e-mail, telefone ou subject;
- hard delete, retenção, anonimização e verificação de posse não são decididos
  por este ADR.

## Alternativas consideradas

### Unicidade global inclusive para contas excluídas

Preservaria uma reserva permanente, mas impediria reutilização legítima e
transformaria retenção histórica em bloqueio operacional indefinido.

### Consultar antes de inserir sem constraint única

Foi rejeitada porque possui condição de corrida. A decisão precisa permanecer
correta com pools, processos e transações concorrentes.

### Apagar ou anonimizar imediatamente no soft delete

Anteciparia regras de retenção, direitos do titular, auditoria e integridade de
referências ainda não aprovadas. Esses comportamentos exigem ticket e revisão
próprios.

### Tabela separada de tombstones ou histórico de identificadores

Permitiria políticas temporais mais sofisticadas, mas adicionaria complexidade
sem requisito atual. Pode ser introduzida por migration forward se retenção ou
prevenção de takeover exigir reserva posterior.

## Consequências

- o PostgreSQL arbitra duplicidades de forma atômica e determinística;
- o plano de consulta de identidade ativa usa o mesmo predicado do índice;
- e-mail com diferença apenas de caixa conflita enquanto a conta está ativa;
- soft delete libera os três tipos de identificador sem apagar a linha antiga;
- restauração pode falhar legitimamente e não deve sobrescrever a conta que
  reutilizou o identificador;
- mudar para reserva permanente exige uma migration e tratamento dos valores
  já reutilizados; voltar ao estado anterior consiste em uma nova migration,
  nunca em editar ou reverter destrutivamente o histórico aplicado.

---

Documentação Protege Mais — ADR-004
