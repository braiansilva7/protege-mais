# EPIC 02 — Identidade, autenticação e autorização contextual

Este épico só começa após a fundação de dados. Nenhum mecanismo de frontend é
considerado controle de acesso. Todos os tickets estão inicialmente `Pendente`.

## PROT-022

### Autenticar por e-mail e senha

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-005, PROT-015, PROT-016 |

**Objetivo:** validar credenciais sem revelar a existência ou o estado de uma
conta.

**Escopo:** normalização de e-mail, verificação de hash, bloqueio de contas não
elegíveis, atualização segura do último login e use case reutilizável pela rota
de login; rate limit será integrado ao endpoint.

**Regras:** resposta externa é uniforme para credencial inválida; hash e motivo
interno não são expostos; comparação evita atalho inseguro; algoritmo e
parâmetros de senha exigem ADR.

**Critérios de aceite:** credencial correta autentica conta ativa; senha, conta
inexistente e conta bloqueada produzem resposta externa não enumerável; eventos
de sucesso/falha são auditáveis sem PII.

**Testes:** unitários do use case, integração com hashes válidos/inválidos,
temporização razoavelmente uniforme e rate limit no contrato final.

**Documentação:** fluxo de autenticação, política de senha aprovada e ADR.

## PROT-023

### Emitir access token

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-022 |

**Objetivo:** emitir access token curto, verificável e com finalidade definida.

**Escopo:** claims mínimas (`sub`, session id, `iat`, `exp`, issuer/audience),
assinatura, validação e integração ao login; contexto de organização não deve ser
congelado no token quando puder mudar durante sua validade.

**Critérios de aceite:** token válido é aceito somente pelo issuer/audience
corretos; expirado, alterado ou assinado com outra chave é rejeitado; payload não
contém PII, permissões sensíveis desnecessárias nem segredo.

**Testes:** assinatura/verificação, expiração controlada, issuer/audience e
inspeção de claims.

**Documentação:** contrato e ciclo de vida do access token, sem publicar chaves.

## PROT-024

### Rotacionar refresh token

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-016, PROT-023 |

**Objetivo:** manter sessões renováveis com rotação, hash e detecção de reuso.

**Escopo:** emissão inicial, armazenamento de hash, endpoint de refresh,
rotação atômica, expiração, vínculo ao dispositivo e política defensiva para
token reutilizado.

**Regras:** token puro existe apenas na resposta segura; concorrência não pode
emitir dois sucessores válidos; erro não enumera sessão.

**Critérios de aceite:** refresh válido entrega novo par e invalida o anterior;
reuso dispara a política aprovada; revogado/expirado falha; sessão registra
último uso sem armazenar o token.

**Testes:** integração, duas requisições concorrentes, reuso, expiração e
redaction de logs.

**Documentação:** diagrama de rotação e política de comprometimento.

## PROT-025

### Implementar logout

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-024 |

**Objetivo:** encerrar a sessão atual de maneira idempotente.

**Escopo:** rota, schema, controller, use case e repository para revogar a
sessão vinculada ao token; limpeza de credenciais nos clientes fica documentada
para as etapas Web/Mobile.

**Critérios de aceite:** logout revoga a sessão atual; repetir a operação não
reabre nem gera erro inseguro; refresh posterior falha; outras sessões continuam
ativas.

**Testes:** autenticado, sem token, sessão já revogada e isolamento entre
dispositivos.

**Documentação:** contrato da rota e changelog.

## PROT-026

### Revogar sessões

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-024 |

**Objetivo:** listar dispositivos e revogar uma ou todas as sessões da própria
conta, além da capacidade administrativa autorizada.

**Escopo:** listagem sanitizada, revogação por ID e revogação global; regras para
preservar ou revogar a sessão atual; autorização administrativa contextual.

**Critérios de aceite:** usuário vê apenas suas sessões; hash/IP bruto não é
retornado; revogação alheia exige permissão e escopo; operação em lote é
atômica conforme contrato.

**Testes:** própria conta, outra conta, sem permissão, múltiplas sessões e
concorrência com refresh.

**Documentação:** endpoints, permissões e comportamento por dispositivo.

## PROT-027

### Recuperar senha com segurança

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-010, PROT-015, PROT-016 |

**Objetivo:** permitir redefinição de senha sem enumerar contas ou reutilizar
tokens.

**Escopo:** solicitação com resposta uniforme, token aleatório armazenado como
hash, validade/uso único, job de notificação, confirmação da nova senha e
revogação de sessões conforme política aprovada.

**Critérios de aceite:** conta existente e inexistente têm resposta externa
equivalente; token válido funciona uma vez; expirado/usado falha; nova senha
invalida credenciais anteriores conforme política; token não aparece em log.

**Testes:** solicitação, confirmação, reuso, expiração, concorrência, rate limit
e provider sem senha local.

**Documentação:** fluxo, política de revogação e template sem dados reais.

## PROT-028

### Implantar MFA

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-022, PROT-027 |

**Objetivo:** adicionar segundo fator e recuperação segura para perfis definidos
pela política de risco.

**Escopo:** ADR do fator inicial; ativação com confirmação, challenge no login,
desativação protegida, códigos de recuperação armazenados como hash e eventos de
auditoria.

**Critérios de aceite:** MFA só ativa após prova válida; challenge expira e tem
tentativas limitadas; código de recuperação é uso único; mudança sensível exige
reauth; segredo nunca aparece em log após o provisionamento.

**Testes:** ativação, challenge correto/incorreto/expirado, replay, recuperação,
desativação e rate limit.

**Documentação:** ADR do fator, fluxo e procedimento de recuperação.

## PROT-029

### Criar middleware de autenticação

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-023, PROT-024 |

**Objetivo:** fornecer identidade autenticada consistente às rotas protegidas.

**Escopo:** extrair bearer token, validar assinatura/claims/expiração, conferir
conta e sessão quando exigido e anexar principal tipado ao request.

**Critérios de aceite:** rota protegida rejeita ausência, formato inválido,
token expirado e sessão revogada; principal contém somente campos aprovados;
rota pública não sofre dependência acidental.

**Testes:** integração HTTP de todos os estados e redaction de header/token.

**Documentação:** contrato do principal e guia de proteção de rota.

## PROT-030

### Criar middleware de permissão

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-017, PROT-018, PROT-029 |

**Objetivo:** autorizar por código de permissão e contexto, nunca por `role ===`.

**Escopo:** serviço de autorização, middleware declarativo por rota, resolução de
papéis/permissões vigentes e cache curto com invalidação segura se adotado.

**Critérios de aceite:** permissão presente concede; ausente nega; papel em outra
organização não concede; alteração de papel passa a valer dentro da política de
consistência; frontend não é necessário para a proteção.

**Testes:** autorizado, sem permissão, papel errado, contexto errado, papel
inativo e matriz inicial completa.

**Documentação:** catálogo/matriz de permissões e exemplos de rota.

## PROT-031

### Aplicar escopo de organização

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-021, PROT-030 |

**Objetivo:** impedir acesso cruzado entre organizações.

**Escopo:** resolução explícita do organizationId, validação de membership e
papel contextual, contexto tipado e obrigação de filtros nos repositories de
recursos multi-tenant.

**Critérios de aceite:** recurso de A não é visível/alterável por membro apenas
de B; ID fornecido pelo cliente não substitui membership; organização inativa
nega operação; conta multi-organização seleciona contexto válido.

**Testes:** matriz A/B, IDs manipulados, vínculo inativo e ausência de contexto.

**Documentação:** modelo de tenancy e checklist de repository.

## PROT-032

### Aplicar escopo de unidade

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-020, PROT-021, PROT-031 |

**Objetivo:** restringir operações à unidade quando a política exigir.

**Escopo:** contexto de unidade, validação de pertencimento à organização,
permissão organizacional versus permissionamento limitado à unidade e filtros
obrigatórios.

**Critérios de aceite:** profissional de uma unidade não acessa outra sem
concessão; gestor organizacional autorizado pode operar conforme política;
unidade de outra organização é sempre rejeitada.

**Testes:** matriz organização/unidades, unidade inativa e tentativa de troca de
ID.

**Documentação:** matriz de escopos e exemplos.

## PROT-033

### Criar contexto de auditoria

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-008, PROT-029, PROT-031 |

**Objetivo:** propagar quem, onde e por qual correlação uma operação ocorreu.

**Escopo:** account, organization, unit, requestId, correlationId, origem e modo
de acesso; interface reutilizável por use cases e worker; eventos sem payload
sensível.

**Critérios de aceite:** operação autenticada recebe contexto completo permitido;
job herda correlação; contexto não pode ser sobrescrito por body do cliente;
ausência obrigatória impede ação auditável.

**Testes:** propagação HTTP→use case→job, spoofing de headers/body e redaction.

**Documentação:** campos, origem e uso do contexto.

## PROT-034

### Implantar acesso excepcional break glass

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-030, PROT-033 |

**Objetivo:** permitir acesso emergencial excepcional, limitado e plenamente
auditável sem criar superpoder permanente.

**Escopo:** permissão específica, justificativa obrigatória, validade curta,
escopo do recurso, confirmação reforçada, evento de início/uso/fim e mecanismo
de revisão/notificação.

**Regras:** não contorna autenticação; não concede operações fora da política;
justificativa não é escrita em log comum; uso sem necessidade é investigável.

**Critérios de aceite:** acesso normal negado pode ser concedido apenas com todos
os requisitos; expiração revoga automaticamente; cada uso é rastreável;
tentativa sem permissão/justificativa falha.

**Testes:** fluxo feliz, expiração, escopo diferente, replay, concorrência e
auditoria completa.

**Documentação:** política operacional aprovada, matriz de permissão e runbook de
revisão.
