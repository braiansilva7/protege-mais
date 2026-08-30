/**
 * Fonte central do schema Drizzle do Protege Mais.
 *
 * Accounts, auth_sessions e o RBAC contextual formam a fundação de identidade
 * persistente. A extensão PostGIS é gerenciada pela migration Atlas; colunas
 * comuns e enums fundamentais materializam os contratos aprovados.
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
  authSessionConstraintNames,
  authSessionIndexNames,
  authSessionPublicSelection,
  authSessions,
  isAuthSessionActive,
  serializePublicAuthSession,
  type AuthSession,
  type NewAuthSession,
  type PublicAuthSession,
} from './auth-sessions.js';
export {
  accountRoles,
  authorizationConstraintNames,
  authorizationIndexNames,
  isRoleMutable,
  permissions,
  rolePermissions,
  roles,
  type AccountRole,
  type NewAccountRole,
  type NewPermission,
  type NewRole,
  type NewRolePermission,
  type Permission,
  type Role,
  type RolePermission,
} from './authorization.js';
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
export {
  isOrganizationOperational,
  organizationConstraintNames,
  organizationIndexNames,
  organizationPublicSelection,
  organizations,
  serializePublicOrganization,
  type NewOrganization,
  type Organization,
  type PublicOrganization,
} from './organizations.js';
export {
  isOrganizationUnitOperational,
  organizationUnitConstraintNames,
  organizationUnitIndexNames,
  organizationUnitPublicSelection,
  organizationUnits,
  parseOrganizationUnitPosition,
  serializePublicOrganizationUnit,
  type NewOrganizationUnit,
  type OrganizationUnit,
  type OrganizationUnitPosition,
  type PublicOrganizationUnit,
} from './organization-units.js';
