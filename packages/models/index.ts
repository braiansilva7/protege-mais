/**
 * Fonte central do schema Drizzle do Protege Mais.
 *
 * A tabela accounts inaugura o schema de domínio no PROT-015. A extensão
 * PostGIS é gerenciada pela migration Atlas; colunas comuns e enums
 * fundamentais materializam os contratos aprovados para os próximos models.
 */
export {
  accountActiveIdentifierIndexNames,
  accountPublicSelection,
  accounts,
  serializePublicAccount,
  type Account,
  type NewAccount,
  type PublicAccount,
} from './accounts.js';
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
