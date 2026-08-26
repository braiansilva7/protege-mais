/**
 * Fonte central do schema Drizzle do Protege Mais.
 *
 * O schema de produção permanece sem tabelas após o PROT-014. A extensão
 * PostGIS é gerenciada pela migration Atlas; colunas comuns e enums
 * fundamentais materializam os contratos aprovados para os próximos models.
 */
export {
  createdAtColumn,
  deletedAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from './columns.js';
export {
  accountStatusEnum,
  accountTypeEnum,
  alertTriggerTypeEnum,
  caseStatusEnum,
  emergencyAlertStatusEnum,
  evidenceTypeEnum,
  incidentSeverityEnum,
  incidentTypeEnum,
  notificationChannelEnum,
  notificationStatusEnum,
  organizationTypeEnum,
  protectiveOrderTermStatusEnum,
  protectiveOrderTermTypeEnum,
  riskLevelEnum,
} from './enums.js';
