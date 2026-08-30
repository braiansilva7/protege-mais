# ADR-008 — Contexto e ciclo de vida do vínculo organizacional

Status: Aceito
Data: 2026-08-30
Ticket: PROT-021

## Contexto

Uma conta pode participar de várias organizações e atuar no contexto geral de
uma instituição ou de uma ou mais unidades. O modelo precisa impedir
duplicidade inclusive quando a unidade é nula, sem misturar pertencimento com
papéis do RBAC.

O ticket também lista matrícula, cargo e estado ativo, mas não define matrícula
como identificador universal nem exige que voluntários, colaboradores ou contas
de serviço possuam esses atributos. Era necessário decidir ainda se desativar um
vínculo liberaria o mesmo contexto para outra linha.

## Decisão

- cada `organization_members` vincula uma conta, uma organização e uma unidade
  opcional;
- a FK composta para organização/unidade garante que uma unidade informada
  pertença à mesma organização;
- `UNIQUE NULLS NOT DISTINCT` sobre conta, organização e unidade rejeita
  duplicidade também no contexto organizacional com unidade nula;
- vínculos organizacionais e de unidades distintos podem coexistir, e uma conta
  pode participar de várias organizações;
- matrícula e cargo são opcionais, normalizados como texto de apresentação e
  não recebem unicidade; a matrícula fica fora da projeção padrão e ambos os
  campos ficam fora de logs;
- `is_active` expressa a vigência local sem default de negócio. A tabela não
  usa soft delete: desativação preserva a linha, e reativação usa optimistic
  locking;
- o contexto continua reservado quando inativo; criar uma segunda linha para
  contornar a inatividade é rejeitado pela mesma unicidade;
- membership não possui `role_id`, e nenhuma mudança de vínculo altera
  `account_roles` automaticamente;
- FKs validam existência, não atividade. A autorização futura avaliará conta,
  organização, unidade, membership, papel e permissão sem trigger oculto.

## Alternativas consideradas

- Manter uma única linha por conta/organização: rejeitado porque impediria
  representar atuação limitada a mais de uma unidade.
- Tratar `NULL` como distinto na unicidade: rejeitado porque permitiria vários
  vínculos organizacionais idênticos.
- Tornar matrícula ou cargo obrigatório: rejeitado porque excluiria contextos
  institucionais que legitimamente não possuem um desses atributos.
- Tornar matrícula única: rejeitado porque o escopo e o formato administrativo
  não foram padronizados pelo domínio e o mesmo profissional pode atuar em
  unidades distintas.
- Usar soft delete e liberar a combinação: rejeitado porque criaria linhas
  concorrentes para o mesmo pertencimento e fragmentaria seu ciclo de vida.
- Armazenar papel no membership: rejeitado porque duplicaria `account_roles` e
  acoplaria pertencimento institucional à política de autorização.
- Bloquear pais inativos por trigger: rejeitado porque atividade é uma decisão
  funcional composta e o trigger não substituiria autenticação, papel ou
  permissão.

## Consequências

O banco arbitra concorrência e coerência contextual sem depender de consulta
prévia. A resolução de memberships ativos possui índice parcial, enquanto FKs
restritivas preservam conta, organização e unidade referenciadas.

Desativar não equivale a apagar nem libera uma identidade contextual. Alterar
conta, organização ou unidade de uma linha deve ser tratado como encerramento
do contexto anterior e criação/reativação deliberada do contexto correto.

O model ainda não autoriza operações. `PROT-030`, `PROT-031` e `PROT-032`
implementarão a decisão funcional que combina membership vigente com os demais
estados e permissões. Auditoria e retenção detalhadas continuam em tickets
próprios; eventual mudança de cardinalidade ou lifecycle exige nova migration
forward e novo ADR.
