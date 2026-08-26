# ADR-001 — BullMQ sobre Redis para filas do Worker

Status: Aceito
Data: 2026-08-26
Ticket: PROT-010

## Contexto

O Worker precisa aguardar cinco filas sem busy loop, aplicar retry/backoff,
distinguir falha transitória de terminal, preservar jobs falhos e encerrar sem
abandonar trabalho ativo. O projeto já possui Redis obrigatório, namespace por
ambiente, cliente oficial `redis` e regras que proíbem payload sensível e regra
de negócio no processor.

A implementação também precisa preservar a fronteira `apps → packages`, manter
o transporte substituível e não antecipar persistência, outbox ou regras dos
domínios futuros.

## Decisão

Usar BullMQ `6.3.0` em `packages/plugins/queues`, com o adaptador oficial para o
cliente `redis` já adotado pelo projeto. As chaves recebem o prefixo
`protege-mais:<ambiente>:queues`, e o catálogo inicial contém `emergency`,
`notifications`, `integrations`, `evidences` e `risk`.

O produtor publica um envelope v1 limitado e usa um hash SHA-256 da chave de
idempotência com o nome do job como `jobId`. Jobs concluídos e falhos são
retidos para preservar deduplicação e permitir tratamento operacional. O
conjunto `failed` de cada fila funciona como dead letter inicial.

BullMQ controla entrega, espera bloqueante, tentativas, backoff exponencial e
shutdown dos consumers. O processor cria contexto e converte as classificações
do caso de uso em falha recuperável ou `UnrecoverableError`; nenhuma regra de
negócio fica nessa camada.

## Alternativas consideradas

- Redis Streams implementado diretamente: reduziria uma dependência, mas
  exigiria construir e manter claim, stalled detection, retry, delayed jobs,
  backoff, dead letter e shutdown, aumentando risco no baseline.
- Uma fila única com tipo no payload: simplificaria conexões, porém misturaria
  prioridades operacionais, falhas e escalabilidade de capacidades distintas.
- `ioredis`: é suportado, mas adicionaria um segundo cliente Redis direto. O
  adaptador `node-redis` do BullMQ v6 permite reutilizar a tecnologia já
  aprovada.
- Remover jobs automaticamente por idade ou quantidade: controlaria crescimento
  imediatamente, mas quebraria deduplicação após remoção e inventaria uma
  política de retenção ainda não aprovada.

## Consequências

- O Worker ganha semântica de entrega pelo menos uma vez, retry limitado,
  backoff, stalled recovery e shutdown gracioso testados contra Redis real.
- Cada instância mantém conexões normais e bloqueantes por fila; operação deve
  considerar esse custo ao dimensionar Redis e réplicas do Worker.
- Idempotência de publicação é garantida enquanto o registro do job existir;
  idempotência de efeito continua obrigatória no caso de uso e na fonte durável.
- Jobs finalizados crescem até que cada domínio aprove retenção, limpeza e
  reprocessamento. Antes de produção, essa política e o monitoramento do conjunto
  `failed` precisam ser definidos.
- A abstração pública em `packages/plugins/queues` evita que casos de uso
  importem BullMQ e permite substituir o backend com impacto concentrado.
