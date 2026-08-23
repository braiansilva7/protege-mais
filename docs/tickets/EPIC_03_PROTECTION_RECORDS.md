# EPIC 03 — Registros de proteção

Cada ticket deste épico entrega uma fatia vertical: model/migration,
repository, interfaces, schemas, use cases, controller/route, permissões,
traduções e Web quando houver operação institucional. Todos estão inicialmente
`Pendente`.

## PROT-035

### Criar perfis de vítima

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-014, PROT-031, PROT-033 |

**Objetivo:** cadastrar e consultar a pessoa protegida sem misturar perfil com
credencial de acesso.

**Escopo:** `victim_profiles`, vínculo opcional com account, organização/unidade
responsável, identidade e contatos mínimos; estratégia de criptografia e hashes
de busca para identificadores definidos em ADR; CRUD institucional inicial,
permissões `victim.list/view/create/update` e telas Web correspondentes.

**Regras:** lista não expõe campos sensíveis desnecessários; CPF/identificadores
não ficam em claro se a estratégia aprovada exigir proteção; duplicidade e
matching não podem revelar vítima de outra organização.

**Critérios de aceite:** criação/lista/detalhe/edição respeitam permissão e escopo;
duplicidade retorna conflito sem vazamento; campos públicos nunca incluem
material criptográfico; toda leitura sensível é auditável.

**Testes:** unitários, repository com criptografia/hash, rotas 401/403/404/409,
isolamento A/B e fluxo Web de lista vazia/criação/edição/erro.

**Documentação:** modelo, API, permissões, classificação de dados, ADR e guia de
uso Web.

## PROT-036

### Criar dispositivos da vítima

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P1       |
| Dependências | PROT-035 |

**Objetivo:** manter dispositivos autorizados para segurança, notificação e
emergência futura.

**Escopo:** `victim_devices`, identificador não reversível quando possível,
plataforma, nome, status, datas de registro/último uso/revogação; API
institucional de consulta/revogação. Registro pelo Mobile fica para a fase
Mobile.

**Regras:** push token e identificador técnico são segredos operacionais; não
aparecem em lista ou log; dispositivo revogado não inicia fluxo protegido.

**Critérios de aceite:** dispositivo pertence a uma única vítima; duplicidade é
tratada idempotentemente; revogação é auditada; acesso cruzado é negado.

**Testes:** constraints, idempotência, revogação, 401/403 e escopo.

**Documentação:** modelo, estados e dados ocultos.

## PROT-037

### Criar configurações de modo discreto

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-035, PROT-036 |

**Objetivo:** persistir preferências de aparência e proteção que reduzam a
exposição do aplicativo em situação de risco.

**Escopo:** `stealth_settings` por vítima/dispositivo conforme ADR, estado ativo,
preferências permitidas e atualização segura; contrato para consumo Mobile
posterior.

**Regras:** configuração não é promessa de invisibilidade no sistema operacional;
mudanças sensíveis exigem autenticação apropriada; valores não são expostos em
logs ou notificações.

**Critérios de aceite:** defaults seguros e documentados; somente titular ou
profissional explicitamente autorizado consulta/altera; concorrência não perde
atualização; dispositivo revogado não altera preferências.

**Testes:** autorização, escopo, defaults, concorrência e resposta sanitizada.

**Documentação:** limitações, modelo e contrato Mobile futuro.

## PROT-038

### Criar contatos da rede de apoio

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-035 |

**Objetivo:** cadastrar pessoas autorizadas a integrar a rede de apoio da
vítima.

**Escopo:** `support_contacts`, nome, canais mínimos, vínculo/ordem, status de
verificação e preferências de acionamento; CRUD institucional e Web; permissões
próprias ou vinculadas ao domínio victim.

**Regras:** contato não recebe informação sensível por padrão; consentimento e
verificação são estados explícitos; exclusão não apaga histórico de alertas.

**Critérios de aceite:** CRUD respeita vítima/organização; contato não verificado
não é tratado como confirmado; duplicidade por vítima é controlada; dados são
mascarados em listas quando aplicável.

**Testes:** validação de canais, escopo A/B, estados de verificação e fluxo Web.

**Documentação:** modelo, consentimento pendente de validação jurídica e canais.

## PROT-039

### Criar casos de proteção

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-035 |

**Objetivo:** organizar o acompanhamento institucional da vítima.

**Escopo:** `cases`, vítima, organização/unidade responsável, identificador
operacional, status, datas relevantes e responsável atual; criar, listar,
detalhar, atualizar, fechar e transferir; Web e permissões `case.*`.

**Regras:** transições de status são explícitas; transferência preserva histórico;
caso fechado não sofre mutação não permitida; detalhes sensíveis não ficam em
campos livres sem classificação.

**Critérios de aceite:** operações respeitam máquina de estados, permissão e
escopo; transferência é atômica/auditada; concorrência usa controle de versão ou
equivalente aprovado.

**Testes:** transições válidas/inválidas, concorrência, transferência, 401/403 e
isolamento A/B; fluxo Web completo.

**Documentação:** estados, API, permissões e diagrama de ciclo de vida.

## PROT-040

### Criar registros de agressores

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-035, PROT-033 |

**Objetivo:** registrar pessoa apontada como agressora com acesso altamente
restrito e linguagem não conclusiva.

**Escopo:** `aggressors`, identidade mínima, aliases e dados de contato
estritamente necessários; proteção criptográfica/hashes; criar, consultar e
atualizar no Web/API; permissões `aggressor.*`.

**Regras:** o registro representa informação do caso, não condenação; pesquisa
global e deduplicação exigem política explícita; lista minimiza PII.

**Critérios de aceite:** somente perfis autorizados acessam; escopo é respeitado;
duplicidade e busca não vazam registros externos; alterações são auditáveis.

**Testes:** criptografia/hash, permissão, escopo, conflito e fluxo Web.

**Documentação:** classificação, terminologia, modelo e ADR de busca/deduplicação.

## PROT-041

### Relacionar casos e agressores

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-039, PROT-040 |

**Objetivo:** vincular um ou mais registros de agressor a casos sem duplicar a
identidade.

**Escopo:** `case_aggressors`, período/status do vínculo e informações
estruturadas estritamente necessárias; endpoints de vincular, listar e remover
vínculo lógico; UI no detalhe do caso.

**Regras:** caso e agressor devem ser acessíveis no mesmo contexto autorizado;
remoção preserva histórico; vínculo duplicado ativo é rejeitado.

**Critérios de aceite:** relação N:N funciona; cross-tenant falha; histórico é
auditado; UI representa ausência e múltiplos vínculos.

**Testes:** constraints, escopo, duplicidade, desvinculação e Web.

**Documentação:** relações do modelo e contrato.

## PROT-042

### Criar ocorrências

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-039, PROT-041 |

**Objetivo:** registrar eventos relevantes de um caso com histórico confiável.

**Escopo:** `incidents`, caso, tipo, severidade, instante, local opcional e relato
protegido; criar/listar/detalhar/corrigir por fluxo auditado; Web e permissões
`incident.create/view/update` quando correção for permitida.

**Regras:** não apagar histórico; correção não sobrescreve silenciosamente o
conteúdo original; coordenadas e relato não entram em logs/listas resumidas.

**Critérios de aceite:** incidente pertence a caso acessível; ordenação temporal
é determinística; correção mantém trilha; severidade/tipo inválidos falham.

**Testes:** persistência sensível, escopo, histórico de correção e UI.

**Documentação:** tipos/severidades, política de correção e API.

## PROT-043

### Criar medidas protetivas

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-039 |

**Objetivo:** acompanhar medidas protetivas relacionadas ao caso.

**Escopo:** `protective_orders`, caso, referência oficial mínima, autoridade,
status, emissão, vigência e revisão; CRUD controlado, Web e permissões
`protective_order.*`.

**Regras:** transições e expiração são explícitas; referência oficial é tratada
como sensível; status não é alterado automaticamente sem regra auditável.

**Critérios de aceite:** medida válida é criada no caso; datas incoerentes falham;
transição inválida é negada; leitura/alteração respeitam escopo e são auditadas.

**Testes:** datas, transições, concorrência, autorização e Web.

**Documentação:** ciclo de vida, campos e permissões.

## PROT-044

### Criar termos de medidas protetivas

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-043 |

**Objetivo:** estruturar condições impostas por uma medida sem depender apenas de
texto livre.

**Escopo:** `protective_order_terms`, tipo, parâmetros permitidos, vigência e
estado; CRUD no contexto da medida; apresentação Web legível.

**Regras:** schema de parâmetros depende do tipo; termo não excede a vigência da
medida sem justificativa/regra; mudança preserva histórico.

**Critérios de aceite:** tipo e parâmetros coerentes são aceitos; combinação
inválida falha; múltiplos termos ordenam deterministicamente; escopo da medida é
herdado.

**Testes:** validação discriminada por tipo, datas, histórico e Web.

**Documentação:** catálogo de termos, schemas e exemplos fictícios.

## PROT-045

### Criar evidências com storage privado

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-010, PROT-039, PROT-042 |

**Objetivo:** armazenar evidências de caso/ocorrência com acesso controlado e
integridade verificável.

**Escopo:** `evidence_items` com metadados, dono/contexto, tipo, tamanho, hash de
integridade, status de processamento e object key opaca; upload validado,
processamento assíncrono, listagem e download por URL curta; Web e permissões
`evidence.create/view/download`.

**Regras:** bucket privado; conteúdo não passa por log; object key não é
confiável quando enviada pelo cliente; falha de processamento não perde
metadados/histórico; retenção e cadeia de custódia exigem decisão especializada.

**Critérios de aceite:** upload autorizado valida tipo/tamanho e integridade;
download reautoriza no momento; URL expira; cross-tenant falha; job duplicado não
duplica objeto/efeito.

**Testes:** integração banco/S3/fila, arquivos inválidos, autorização, URL
expirada, idempotência e falha do storage; fluxo Web.

**Documentação:** lifecycle, API, permissões, runbook de falha e ADR de storage/
integridade.
