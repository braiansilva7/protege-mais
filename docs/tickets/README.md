# Backlog executável

## Como usar

Os tickets abaixo são a unidade mínima de implementação. Execute um por vez,
respeitando dependências. O status deste índice e o status dentro do arquivo do
épico devem permanecer iguais.

Estados permitidos: `Pendente`, `Em andamento`, `Bloqueado` e `Concluído`.

## Índice

| ID                                                 | Título                                     | Prioridade | Dependências                 | Status    |
| -------------------------------------------------- | ------------------------------------------ | ---------- | ---------------------------- | --------- |
| [PROT-000](EPIC_00_FOUNDATION.md#prot-000)         | Sanear o legado e congelar o baseline      | P0         | —                            | Concluído |
| [PROT-001](EPIC_00_FOUNDATION.md#prot-001)         | Consolidar a estrutura do monorepo         | P0         | PROT-000                     | Concluído |
| [PROT-002](EPIC_00_FOUNDATION.md#prot-002)         | Configurar TypeScript, lint e formatter    | P0         | PROT-001                     | Concluído |
| [PROT-003](EPIC_00_FOUNDATION.md#prot-003)         | Centralizar e validar configurações        | P0         | PROT-001                     | Concluído |
| [PROT-004](EPIC_00_FOUNDATION.md#prot-004)         | Implantar o padrão global de erros         | P0         | PROT-002                     | Concluído |
| [PROT-005](EPIC_00_FOUNDATION.md#prot-005)         | Consolidar i18n do backend                 | P1         | PROT-004                     | Concluído |
| [PROT-006](EPIC_00_FOUNDATION.md#prot-006)         | Consolidar API base, health e readiness    | P0         | PROT-003, PROT-004           | Concluído |
| [PROT-007](EPIC_00_FOUNDATION.md#prot-007)         | Consolidar Swagger/OpenAPI                 | P1         | PROT-004, PROT-006           | Concluído |
| [PROT-008](EPIC_00_FOUNDATION.md#prot-008)         | Implantar logging estruturado e seguro     | P0         | PROT-003, PROT-006           | Concluído |
| [PROT-009](EPIC_00_FOUNDATION.md#prot-009)         | Configurar Redis                           | P0         | PROT-003, PROT-006           | Concluído |
| [PROT-010](EPIC_00_FOUNDATION.md#prot-010)         | Criar infraestrutura do Worker             | P0         | PROT-001, PROT-009           | Concluído |
| [PROT-011](EPIC_01_DATA_FOUNDATION.md#prot-011)    | Consolidar PostgreSQL, Drizzle e Atlas     | P0         | PROT-003, PROT-006           | Concluído |
| [PROT-012](EPIC_01_DATA_FOUNDATION.md#prot-012)    | Habilitar e validar PostGIS                | P0         | PROT-011                     | Concluído |
| [PROT-013](EPIC_01_DATA_FOUNDATION.md#prot-013)    | Definir convenções de tabelas e migrations | P0         | PROT-011                     | Concluído |
| [PROT-014](EPIC_01_DATA_FOUNDATION.md#prot-014)    | Criar enums fundamentais                   | P0         | PROT-013                     | Concluído |
| [PROT-015](EPIC_01_DATA_FOUNDATION.md#prot-015)    | Criar tabela accounts                      | P0         | PROT-014                     | Concluído |
| [PROT-016](EPIC_01_DATA_FOUNDATION.md#prot-016)    | Criar tabela auth_sessions                 | P0         | PROT-015                     | Concluído |
| [PROT-017](EPIC_01_DATA_FOUNDATION.md#prot-017)    | Criar estrutura de roles e permissions     | P0         | PROT-013, PROT-015           | Concluído |
| [PROT-018](EPIC_01_DATA_FOUNDATION.md#prot-018)    | Criar seed inicial de permissões           | P0         | PROT-017                     | Pendente  |
| [PROT-019](EPIC_01_DATA_FOUNDATION.md#prot-019)    | Criar tabela organizations                 | P0         | PROT-014                     | Pendente  |
| [PROT-020](EPIC_01_DATA_FOUNDATION.md#prot-020)    | Criar organization_units                   | P0         | PROT-012, PROT-019           | Pendente  |
| [PROT-021](EPIC_01_DATA_FOUNDATION.md#prot-021)    | Criar organization_members                 | P0         | PROT-015, PROT-019, PROT-020 | Pendente  |
| [PROT-022](EPIC_02_IDENTITY_ACCESS.md#prot-022)    | Autenticar por e-mail e senha              | P0         | PROT-005, PROT-015, PROT-016 | Pendente  |
| [PROT-023](EPIC_02_IDENTITY_ACCESS.md#prot-023)    | Emitir access token                        | P0         | PROT-022                     | Pendente  |
| [PROT-024](EPIC_02_IDENTITY_ACCESS.md#prot-024)    | Rotacionar refresh token                   | P0         | PROT-016, PROT-023           | Pendente  |
| [PROT-025](EPIC_02_IDENTITY_ACCESS.md#prot-025)    | Implementar logout                         | P0         | PROT-024                     | Pendente  |
| [PROT-026](EPIC_02_IDENTITY_ACCESS.md#prot-026)    | Revogar sessões                            | P0         | PROT-024                     | Pendente  |
| [PROT-027](EPIC_02_IDENTITY_ACCESS.md#prot-027)    | Recuperar senha com segurança              | P0         | PROT-010, PROT-015, PROT-016 | Pendente  |
| [PROT-028](EPIC_02_IDENTITY_ACCESS.md#prot-028)    | Implantar MFA                              | P0         | PROT-022, PROT-027           | Pendente  |
| [PROT-029](EPIC_02_IDENTITY_ACCESS.md#prot-029)    | Criar middleware de autenticação           | P0         | PROT-023, PROT-024           | Pendente  |
| [PROT-030](EPIC_02_IDENTITY_ACCESS.md#prot-030)    | Criar middleware de permissão              | P0         | PROT-017, PROT-018, PROT-029 | Pendente  |
| [PROT-031](EPIC_02_IDENTITY_ACCESS.md#prot-031)    | Aplicar escopo de organização              | P0         | PROT-021, PROT-030           | Pendente  |
| [PROT-032](EPIC_02_IDENTITY_ACCESS.md#prot-032)    | Aplicar escopo de unidade                  | P0         | PROT-020, PROT-021, PROT-031 | Pendente  |
| [PROT-033](EPIC_02_IDENTITY_ACCESS.md#prot-033)    | Criar contexto de auditoria                | P0         | PROT-008, PROT-029, PROT-031 | Pendente  |
| [PROT-034](EPIC_02_IDENTITY_ACCESS.md#prot-034)    | Implantar acesso excepcional break glass   | P0         | PROT-030, PROT-033           | Pendente  |
| [PROT-035](EPIC_03_PROTECTION_RECORDS.md#prot-035) | Criar perfis de vítima                     | P0         | PROT-014, PROT-031, PROT-033 | Pendente  |
| [PROT-036](EPIC_03_PROTECTION_RECORDS.md#prot-036) | Criar dispositivos da vítima               | P1         | PROT-035                     | Pendente  |
| [PROT-037](EPIC_03_PROTECTION_RECORDS.md#prot-037) | Criar configurações de modo discreto       | P0         | PROT-035, PROT-036           | Pendente  |
| [PROT-038](EPIC_03_PROTECTION_RECORDS.md#prot-038) | Criar contatos da rede de apoio            | P0         | PROT-035                     | Pendente  |
| [PROT-039](EPIC_03_PROTECTION_RECORDS.md#prot-039) | Criar casos de proteção                    | P0         | PROT-035                     | Pendente  |
| [PROT-040](EPIC_03_PROTECTION_RECORDS.md#prot-040) | Criar registros de agressores              | P0         | PROT-035, PROT-033           | Pendente  |
| [PROT-041](EPIC_03_PROTECTION_RECORDS.md#prot-041) | Relacionar casos e agressores              | P0         | PROT-039, PROT-040           | Pendente  |
| [PROT-042](EPIC_03_PROTECTION_RECORDS.md#prot-042) | Criar ocorrências                          | P0         | PROT-039, PROT-041           | Pendente  |
| [PROT-043](EPIC_03_PROTECTION_RECORDS.md#prot-043) | Criar medidas protetivas                   | P0         | PROT-039                     | Pendente  |
| [PROT-044](EPIC_03_PROTECTION_RECORDS.md#prot-044) | Criar termos de medidas protetivas         | P0         | PROT-043                     | Pendente  |
| [PROT-045](EPIC_03_PROTECTION_RECORDS.md#prot-045) | Criar evidências com storage privado       | P0         | PROT-010, PROT-039, PROT-042 | Pendente  |
| [PROT-046](EPIC_04_EMERGENCY_LOCATION.md#prot-046) | Criar alertas de emergência                | P0         | PROT-010, PROT-035, PROT-039 | Pendente  |
| [PROT-047](EPIC_04_EMERGENCY_LOCATION.md#prot-047) | Criar destinatários do alerta              | P0         | PROT-038, PROT-046           | Pendente  |
| [PROT-048](EPIC_04_EMERGENCY_LOCATION.md#prot-048) | Criar eventos imutáveis do alerta          | P0         | PROT-033, PROT-046           | Pendente  |
| [PROT-049](EPIC_04_EMERGENCY_LOCATION.md#prot-049) | Criar sessões de localização               | P0         | PROT-012, PROT-036, PROT-046 | Pendente  |
| [PROT-050](EPIC_04_EMERGENCY_LOCATION.md#prot-050) | Criar pontos de localização                | P0         | PROT-012, PROT-049           | Pendente  |

## Definition of Done comum

Além dos critérios do ticket:

- TypeScript, lint, formatter, testes e build relevantes passam;
- migration é reproduzível do zero e possui verificação de rollback/forward
  conforme a estratégia vigente;
- rota possui schema/OpenAPI, autenticação, permissão e escopo quando aplicável;
- mensagens existem em `pt-BR`, `en` e `es` quando visíveis;
- não há segredo ou dado sensível em log, fixture ou resposta indevida;
- documentação e `docs/implementation/CHANGELOG.md` foram atualizados;
- novas decisões arquiteturais possuem ADR.

## Regra para o próximo ticket

Não iniciar automaticamente o ticket seguinte. Primeiro entregue o resultado e
as evidências do ticket atual para validação. O usuário então chama o próximo ID.
