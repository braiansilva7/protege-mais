# EPIC 04 — Emergência e localização

Este épico contém fluxos críticos. A conclusão exige testes de concorrência,
idempotência, falha de dependência e não vazamento de dados. Todos os tickets
estão inicialmente `Pendente`.

## PROT-046

### Criar alertas de emergência

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-010, PROT-035, PROT-039 |

**Objetivo:** aceitar um pedido de emergência rapidamente, persistir seu estado
e iniciar processamento assíncrono confiável.

**Escopo:** `emergency_alerts` com vítima, caso opcional, dispositivo, tipo de
gatilho, status, timestamps e chave de idempotência; `POST
/api/v1/emergency-alerts`; use case transacional; publicação na fila `emergency`;
permissões para consulta, assumir, despachar e resolver; painel Web mínimo de
alertas recebidos.

**Regras:** integrações, push e SMS nunca bloqueiam a resposta; requisição
repetida com a mesma chave não cria outro alerta; resposta confirma apenas o que
foi duravelmente aceito; transição de status é controlada; conteúdo sensível não
entra em log ou payload excessivo de job.

**Critérios de aceite:** primeiro pedido cria e retorna imediatamente o alerta;
replay devolve o mesmo resultado sem duplicar; falha antes da persistência não
confirma aceitação; falha temporária após persistência permanece recuperável;
consulta/operação exige permissão e escopo.

**Testes:** integração API/banco/fila, concorrência da idempotency key, Redis
indisponível, worker indisponível, transições inválidas, 401/403 e isolamento
organizacional; Web com atualização de status.

**Documentação:** contrato, máquina de estados, SLO a definir, runbook de fila e
ADR de consistência banco→fila (por exemplo, outbox transacional).

## PROT-047

### Criar destinatários do alerta

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-038, PROT-046 |

**Objetivo:** registrar quem deve receber ou tratar um alerta e o resultado de
cada acionamento.

**Escopo:** `alert_recipients` para contatos de apoio, unidade/central e
integrações aprovadas; snapshot mínimo do destino no instante do alerta; canal,
prioridade e status de entrega; resolução idempotente pelo worker.

**Regras:** contato não verificado não recebe por padrão; mudanças posteriores
na rede não reescrevem histórico; um destino falho não impede os demais; dados
de contato não aparecem em logs.

**Critérios de aceite:** destinatários elegíveis são resolvidos uma vez; cada
entrega evolui independentemente; retry não cria duplicata; operador autorizado
vê status sanitizado.

**Testes:** nenhum/múltiplos contatos, não verificado, falha parcial, retry,
idempotência e autorização.

**Documentação:** regras de seleção, canais, status e dados de snapshot.

## PROT-048

### Criar eventos imutáveis do alerta

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-033, PROT-046 |

**Objetivo:** manter uma linha do tempo confiável de todas as transições e ações
relevantes do alerta.

**Escopo:** `alert_events` append-only com alerta, tipo, instante, ator/contexto,
correlationId e metadata estruturada permitida; consulta cronológica; geração
atômica junto às mudanças críticas.

**Regras:** não atualizar, soft-delete ou excluir eventos por operação comum;
metadata usa allowlist e não armazena relato, token ou coordenada; ordenação
resolve eventos com o mesmo timestamp.

**Critérios de aceite:** criação/transição/assunção/despacho/resolução geram
eventos; tentativa de mutação é impedida; timeline é determinística; evento do
worker preserva correlação.

**Testes:** constraints de imutabilidade, transação com alerta, concorrência,
ordenação e sanitização de metadata.

**Documentação:** catálogo de eventos, schema de metadata e política de retenção
pendente.

## PROT-049

### Criar sessões de localização

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-012, PROT-036, PROT-046 |

**Objetivo:** controlar o início, duração e encerramento do compartilhamento de
localização associado a uma situação de proteção.

**Escopo:** `location_sessions` com vítima/dispositivo, alerta opcional, status,
início, expiração, fim e motivo controlado; endpoints de iniciar/consultar/
encerrar; regras de acesso operacional.

**Regras:** sessão tem duração limitada e finalidade explícita; dispositivo
revogado não inicia; encerramento é idempotente; autorização de leitura de
localização é mais restrita que leitura comum do caso.

**Critérios de aceite:** somente contexto elegível inicia; sessão expira/encerra
corretamente; múltiplas sessões seguem regra documentada; acesso indevido não
revela sequer a existência da sessão quando aplicável.

**Testes:** estados, expiração com relógio controlado, dispositivo revogado,
concorrência, 401/403 e break glass auditado.

**Documentação:** ciclo de vida, finalidade, acesso e retenção a validar.

## PROT-050

### Criar pontos de localização

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-012, PROT-049 |

**Objetivo:** receber e consultar pontos geoespaciais de uma sessão com
integridade temporal e proteção rigorosa.

**Escopo:** `location_points` append-only com sessão, position
`geography(Point,4326)`, instante do dispositivo/servidor, precisão permitida e
chave de deduplicação; ingestão unitária ou em lote definida por contrato;
consulta operacional limitada e índices espaciais/temporais.

**Regras:** latitude/longitude e precisão inválidas são rejeitadas; ponto não é
aceito fora da janela tolerada ou de sessão ativa sem regra explícita; logs e
erros nunca incluem coordenadas; retenção/compactação dependem de política
aprovada.

**Critérios de aceite:** pontos válidos mantêm ordem consultável; replay não
duplica; sessão alheia/inativa falha; consulta espacial funciona; volume de teste
atende baseline documentado sem varredura integral.

**Testes:** integração PostGIS, limites geográficos, timestamps fora de ordem,
batch parcial, idempotência, carga/índices e matriz de autorização.

**Documentação:** contrato de ingestão, modelo espacial, acesso, retenção
pendente e ADR de particionamento/volume se necessário.
