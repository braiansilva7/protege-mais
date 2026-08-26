# Filas e operação do Worker

## Responsabilidade

O Worker consome trabalho assíncrono por BullMQ sobre o Redis compartilhado.
`packages/plugins/queues` implementa transporte, catálogo, envelope, publicação,
retry e lifecycle. `apps/worker` adapta cada job para um processor, e o
processor delega toda decisão a um caso de uso registrado em
`packages/useCases/jobs`.

O Redis continua não sendo fonte de verdade de domínio. Um produtor só publica
depois que o ticket consumidor definir como o estado durável e o job permanecem
consistentes. Fluxos críticos, como emergência, ainda exigirão uma decisão
específica de outbox ou técnica equivalente.

## Catálogo

| Fila            | Responsabilidade aprovada                                      |
| --------------- | -------------------------------------------------------------- |
| `emergency`     | efeitos assíncronos de alertas de emergência já persistidos    |
| `notifications` | entregas de comunicação e notificações                         |
| `integrations`  | chamadas a adaptadores e sistemas institucionais externos      |
| `evidences`     | processamento assíncrono de evidências, nunca seu conteúdo     |
| `risk`          | cálculos e reprocessamentos de avaliação de risco referenciada |

O catálogo não ativa nenhum fluxo de domínio. Cada novo nome de job precisa de
contrato, caso de uso e testes no ticket que o introduzir. Uma nova fila ou
mudança de responsabilidade exige atualização deste documento e avaliação de
ADR.

No Redis, BullMQ usa o prefixo:

```text
protege-mais:<ambiente>:queues:<fila>:
```

O namespace separa ambientes, mas não substitui credenciais, rede restrita e
instância isolada em produção.

## Envelope v1

Todo job aceito pelo Worker usa o envelope abaixo:

```ts
interface BaseJobEnvelope {
  version: 1;
  correlationId: string;
  payload: Readonly<Record<string, unknown>>;
}
```

- `version` permite evoluir o contrato sem interpretar formatos ambíguos;
- `correlationId` preserva a cadeia iniciada na API; cada tentativa gera um
  `requestId` próprio no consumer;
- `payload` contém somente referências e metadados operacionais mínimos.

O envelope é limitado a 16 KiB, aceita apenas JSON finito, rejeita ciclos,
objetos especiais, profundidade excessiva e nomes de campo que representem
credencial, identificador pessoal, conteúdo, arquivo ou coordenada. Essa
validação é uma barreira adicional e não substitui revisão do contrato de cada
job.

Não publicar request, headers, logger, URL assinada, token, CPF, contato,
endereço, relato, coordenada, arquivo ou conteúdo de evidência. Quando o caso de
uso precisar desses dados, o payload deve carregar uma referência opaca e o
caso de uso deve buscar a fonte durável após autorização e escopo apropriados.

## Publicação e idempotência

O produtor informa fila, nome técnico do job, envelope e uma chave de
idempotência estável para a operação. A chave não é persistida literalmente:
`packages/plugins/queues` calcula SHA-256 sobre nome do job e chave e usa
`job-<digest>` como `jobId` do BullMQ.

Um segundo publish com a mesma chave e o mesmo nome na mesma fila encontra o
job existente e não cria outra execução. Jobs concluídos e falhos não são
removidos automaticamente; essa retenção preserva deduplicação após reinício e
mantém a falha disponível para operação. Não remover um registro sem avaliar a
janela de idempotência e o estado durável correspondente.

BullMQ oferece entrega pelo menos uma vez: um job ativo pode voltar à espera se
o processo cair ou perder seu lock. Portanto, deduplicar publicação não torna
um efeito externo exatamente uma vez. O caso de uso deve usar `jobId` e a fonte
durável para tornar seu efeito idempotente; o processor não pode implementar
essa regra.

Retenção temporal, limpeza automática e ferramenta de reprocessamento global
dependem dos requisitos jurídicos e operacionais de cada domínio e continuam
fora deste baseline.

## Processor e caso de uso

O fluxo executável é:

```text
QueueProducer → Redis/BullMQ → QueueWorkerPool → JobProcessor → JobUseCase
```

O `JobProcessor` pode validar envelope, criar contexto correlacionado, medir a
tentativa, localizar o caso de uso e classificar o resultado. Regra de negócio,
autorização, consulta, persistência e efeito externo pertencem ao caso de uso e
aos serviços/repositórios que ele orquestrar.

Casos de uso classificam falhas conhecidas assim:

- `RetryableJobError`: dependência ou condição transitória que pode ser tentada
  novamente sem quebrar idempotência;
- `TerminalJobError`: payload, estado ou condição que não será corrigida por uma
  nova tentativa automática;
- erro não classificado: tratado como terminal para evitar repetição insegura.

Um job sem caso de uso registrado ou com envelope/identificador inválido também
falha de forma terminal.

## Retry, backoff e falha controlada

A política base faz três tentativas totais. Depois de uma falha transitória, o
backoff exponencial usa 1 segundo como base: antes da segunda tentativa aguarda
aproximadamente 1 segundo e antes da terceira, 2 segundos. Tickets consumidores
podem propor política distinta somente com justificativa de operação,
idempotência e impacto no serviço externo.

Falha terminal ignora as tentativas restantes. Falha transitória que esgota as
três tentativas e falha terminal permanecem no conjunto `failed` da própria
fila. Esse conjunto é a dead letter inicial deste baseline e nunca é removido
automaticamente.

O BullMQ bloqueia a conexão à espera de trabalho; não existe polling de
aplicação nem busy loop. Cada fila processa um job por vez em cada instância do
Worker neste baseline. Escalar instâncias aumenta o paralelismo e exige que o
caso de uso continue idempotente e seguro sob concorrência.

## Observabilidade

O Worker emite somente metadados permitidos:

| Evento                       | Uso                                               |
| ---------------------------- | ------------------------------------------------- |
| `worker.ready`               | todos os consumers conectaram e aguardam jobs     |
| `worker.job.started`         | início de uma tentativa                           |
| `worker.job.completed`       | tentativa concluída, com duração                  |
| `worker.job.retry.scheduled` | falha transitória ainda possui tentativa restante |
| `worker.job.failed`          | falha terminal ou tentativas esgotadas            |
| `worker.stopped`             | encerramento por sinal concluído                  |
| `queue.connection.error`     | conexão de fila indisponível                      |
| `queue.producer.error`       | falha segura do produtor                          |
| `queue.worker.error`         | falha segura do consumer                          |

Eventos de job podem conter `requestId`, `correlationId`, `queue`, `processor`,
`attempt`, `maxAttempts`, `durationMs`, `failureType` e `errorCode`. Não contêm
`jobId`, chave de idempotência, payload, mensagem, stack ou causa.

## Shutdown gracioso

Ao receber `SIGINT` ou `SIGTERM`, o Worker fecha primeiro os consumers. O
BullMQ deixa de buscar novos jobs e `close()` aguarda o job ativo terminar.
Depois, o processo fecha as conexões das filas e a conexão Redis compartilhada.

Todo caso de uso deve impor timeout às próprias integrações. O fechamento
gracioso não possui timeout interno e não corrige um caso de uso que aguarde uma
dependência indefinidamente. Uma interrupção forçada pode tornar o job stalled;
outro Worker poderá retomá-lo, reforçando a exigência de idempotência.

## Operação local

Inicie o Redis e o Worker:

```bash
docker compose up --build -d --wait redis worker
docker compose logs -f worker
```

Ou execute pelo host:

```bash
docker compose up -d --wait redis
pnpm dev:worker
```

Valide o cliente Redis e o pipeline completo de filas:

```bash
pnpm --filter @protege-mais/plugins test:redis
pnpm --filter @protege-mais/worker test:redis
```

A integração do Worker usa referências fictícias, reduz o backoff para o teste
e remove somente seus jobs concluídos ou falhos. Metadados vazios das filas
podem permanecer no namespace local.

## Runbook inicial de falha

1. Filtre `worker.job.failed` por `queue`, `processor`, `failureType` e
   `errorCode`; use `correlationId` para reconstruir a cadeia sem buscar dado
   pessoal.
2. Confirme na fonte durável se a operação original foi aceita e se algum efeito
   já ocorreu. Nunca assuma falha de domínio apenas porque a tentativa da fila
   falhou.
3. Para `exhausted`, corrija primeiro a dependência externa e confirme que o
   caso de uso tolera nova execução. Para `terminal`, corrija contrato, estado
   ou código antes de considerar reprocessamento.
4. Reprocesse somente por uma ferramenta operacional aprovada no ticket do
   domínio. Não edite listas, hashes ou sorted sets do BullMQ com `redis-cli`.
5. Mantenha o job no conjunto `failed` até existir evidência do tratamento.
   Remoção libera novamente seu `jobId` e pode quebrar a janela de
   idempotência.
6. Se a falha afetar `emergency`, preserve o alerta durável e escale pelo
   procedimento operacional do domínio; indisponibilidade de integração nunca
   pode apagar ou ocultar o alerta.

---

Documentação Protege Mais — Filas e operação do Worker
