# EPIC 01 — Fundação de dados

Este épico cria a persistência básica sem introduzir ainda os fluxos de login ou
de proteção. Todos os tickets estão inicialmente `Pendente`.

## PROT-011

### Consolidar PostgreSQL, Drizzle e Atlas

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Concluído          |
| Prioridade   | P0                 |
| Dependências | PROT-003, PROT-006 |

**Objetivo:** criar a infraestrutura oficial de persistência em PostgreSQL,
Drizzle e Atlas.

**Escopo:** pool configurado por app, plugin de banco, export central de models,
ambientes Atlas `prod` e `seed/dev`, Compose local e shutdown; UTC, UUID e
`TIMESTAMPTZ` como padrões.

**Critérios de aceite:** conecta, executa query e fecha corretamente; migrations
podem criar uma base vazia; seed não é requisito para migration; readiness
reflete o banco; falhas não expõem credenciais.

**Testes:** banco limpo → migrate → query → shutdown; migration repetida sem
divergência; conexão inválida.

**Documentação:** setup local, fluxo Atlas e estado inicial do banco.

## PROT-012

### Habilitar e validar PostGIS

| Campo        | Valor     |
| ------------ | --------- |
| Status       | Concluído |
| Prioridade   | P0        |
| Dependências | PROT-011  |

**Objetivo:** preparar consultas geoespaciais futuras.

**Escopo:** imagem PostgreSQL compatível com PostGIS; migration idempotente
`CREATE EXTENSION IF NOT EXISTS postgis`; verificação de versão e operação com
SRID 4326.

**Critérios de aceite:** migration funciona em base vazia; extensão é detectada;
consulta geoespacial simples produz resultado correto; ambiente sem suporte
falha com diagnóstico claro.

**Testes:** integração real com criação de pontos e distância conhecida.

**Documentação:** requisitos da imagem, SRID e convenções espaciais.

## PROT-013

### Definir convenções de tabelas e migrations

| Campo        | Valor     |
| ------------ | --------- |
| Status       | Concluído |
| Prioridade   | P0        |
| Dependências | PROT-011  |

**Objetivo:** congelar convenções antes das tabelas de domínio.

**Escopo:** `snake_case` no banco, `camelCase` em TypeScript, UUID v7 na
aplicação, timestamps UTC, nomes de FK/índice, nulabilidade, unicidade,
concorrência e política explícita de soft delete.

**Regras:** `audit_logs`, `alert_events` e `risk_assessments` não recebem soft
delete automático; migrations não dependem de seed.

**Critérios de aceite:** convenções documentadas com exemplos; model/migration
de referência prova o mapeamento; revisão automatizada cobre o que for viável.

**Testes:** export/diff Drizzle-Atlas sem drift no exemplo.

**Documentação:** criar guia de banco e checklist de migration.

## PROT-014

### Criar enums fundamentais

| Campo        | Valor     |
| ------------ | --------- |
| Status       | Concluído |
| Prioridade   | P0        |
| Dependências | PROT-013  |

**Objetivo:** evitar strings mágicas e alinhar banco/TypeScript.

**Escopo:** status/tipo de conta, tipo de organização, status de caso, nível de
risco, tipo/severidade de incidente, status/tipo de termo de medida, status/tipo
de gatilho de alerta, tipo de evidência e canal/status de notificação.

**Critérios de aceite:** migration e enums TypeScript têm valores equivalentes;
valores inválidos são rejeitados; exports são centralizados; a estratégia de
evolução de enum está documentada.

**Testes:** paridade banco/código e inserção inválida.

**Documentação:** catálogo semântico de valores, sem inventar regras ainda não
aprovadas.

## PROT-015

### Criar tabela accounts

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-014 |

**Objetivo:** persistir identidades de acesso, separadas de perfis de vítima ou
profissional.

**Escopo:** id, e-mail original/normalizado, telefone E.164, password hash,
provider externo, tipo/status, MFA, último login e timestamps/soft delete;
índices e restrições para identificadores ativos.

**Regras:** ao menos um método de identidade coerente com o provider; e-mail
normalizado não se duplica entre contas ativas; hash nunca é retornado.

**Critérios de aceite:** conta válida é persistida; duplicidade ativa resulta em
conflito determinístico; combinação inválida é rejeitada; soft delete respeita
a política de reutilização decidida em ADR.

**Testes:** migration, constraints, normalização, concorrência de duplicidade e
serialização pública.

**Documentação:** dicionário de dados e ADR da unicidade/reutilização.

## PROT-016

### Criar tabela auth_sessions

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-015 |

**Objetivo:** suportar refresh token rotacionável e gestão de dispositivos.

**Escopo:** conta, hash do refresh token, identificador/nome do dispositivo,
hash de IP, user agent sanitizado, expiração, último uso, revogação e criação;
índices para busca/revogação.

**Regras:** token puro nunca é persistido; sessão expirada ou revogada não é
ativa; metadados são minimizados e possuem retenção definida posteriormente.

**Critérios de aceite:** sessão ativa pode ser localizada pelo hash; revogação é
atômica; consultas de sessão não expõem hash; exclusão de conta não perde
histórico exigido.

**Testes:** constraints, expiração, revogação concorrente e índices relevantes.

**Documentação:** dicionário e ciclo de vida da sessão.

## PROT-017

### Criar estrutura de roles e permissions

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-013, PROT-015 |

**Objetivo:** modelar papéis contextuais sem fixá-los diretamente na conta.

**Escopo:** `roles`, `permissions`, `role_permissions` e `account_roles`, com
contextos opcionais de organização/unidade e papéis de sistema protegidos.

**Regras:** uma conta pode ter papéis diferentes em organizações diferentes;
permissão usa `<recurso>.<ação>`; duplicidades e escopos incoerentes são
rejeitados.

**Critérios de aceite:** relações N:N funcionam; atribuição contextual é única;
papel de sistema não sofre mutação indevida; consulta eficiente retorna
permissões no contexto solicitado.

**Testes:** constraints, múltiplas organizações, remoção referenciada e plano de
consulta.

**Documentação:** diagrama RBAC e regras de escopo.

## PROT-018

### Criar seed inicial de permissões

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-017 |

**Objetivo:** popular desenvolvimento com catálogo versionado de permissões.

**Escopo:** account, organization, victim e case com ações list/view/create/
update e ações específicas disable/close/transfer; papéis iniciais apenas se
explicitamente definidos.

**Critérios de aceite:** seed é idempotente; não remove atribuições locais; todos
os códigos existem também no catálogo TypeScript; migration prod roda sem seed.

**Testes:** aplicar duas vezes, comparar catálogo banco/código e executar
migration prod isoladamente.

**Documentação:** catálogo inicial e processo de expansão.

## PROT-019

### Criar tabela organizations

| Campo        | Valor    |
| ------------ | -------- |
| Status       | Pendente |
| Prioridade   | P0       |
| Dependências | PROT-014 |

**Objetivo:** representar instituições participantes.

**Escopo:** nome, razão social, tipo, CNPJ, UF, código de município, flags ativa/
integração e timestamps/soft delete; normalização e índices de pesquisa.

**Regras:** CNPJ não recebe a mesma classificação de dado pessoal da vítima,
mas continua protegido contra exposição indevida; organização inativa não cria
novo contexto operacional.

**Critérios de aceite:** organização válida é persistida; identificador
institucional duplicado segue regra documentada; tipos/status inválidos falham.

**Testes:** migration, normalização/constraints, soft delete e consulta indexada.

**Documentação:** dicionário de dados e regras de ativação.

## PROT-020

### Criar organization_units

| Campo        | Valor              |
| ------------ | ------------------ |
| Status       | Pendente           |
| Prioridade   | P0                 |
| Dependências | PROT-012, PROT-019 |

**Objetivo:** representar unidades operacionais de uma organização.

**Escopo:** organização, nome, código, tipo, contatos, endereço estruturado,
posição geográfica SRID 4326, ativa e timestamps/soft delete.

**Regras:** código é único no contexto da organização; posição válida respeita
longitude/latitude; unidade não pertence a múltiplas organizações.

**Critérios de aceite:** relação 1:N funciona; duplicidade contextual falha;
consulta espacial simples localiza unidades próximas; unidade de organização
inativa não é operacional.

**Testes:** FK, unicidade composta, coordenadas inválidas e consulta PostGIS.

**Documentação:** dicionário e convenção de endereço/localização.

## PROT-021

### Criar organization_members

| Campo        | Valor                        |
| ------------ | ---------------------------- |
| Status       | Pendente                     |
| Prioridade   | P0                           |
| Dependências | PROT-015, PROT-019, PROT-020 |

**Objetivo:** vincular contas às organizações e unidades sem duplicar papéis.

**Escopo:** conta, organização, unidade opcional, matrícula, cargo, ativo e
timestamps; restrições de coerência entre organização/unidade.

**Regras:** role permanece em `account_roles`; unidade informada deve pertencer
à organização; vínculo inativo não concede contexto.

**Critérios de aceite:** vínculo organizacional e por unidade funcionam;
combinação incoerente é rejeitada; uma conta participa de múltiplas
organizações; status ativo é consultável com índice adequado.

**Testes:** FKs, coerência contextual, duplicidade e múltiplas organizações.

**Documentação:** diagrama identidade-organização e dicionário de dados.
