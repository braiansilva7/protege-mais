import {
  accountStatusValues,
  accountTypeValues,
  alertTriggerTypeValues,
  caseStatusValues,
  emergencyAlertStatusValues,
  evidenceTypeValues,
  fundamentalEnumCatalog,
  incidentSeverityValues,
  incidentTypeValues,
  notificationChannelValues,
  notificationStatusValues,
  organizationTypeValues,
  protectiveOrderTermStatusValues,
  protectiveOrderTermTypeValues,
  riskLevelValues,
} from '@protege-mais/common';
import { pgEnum } from 'drizzle-orm/pg-core';

export const accountStatusEnum = pgEnum(
  fundamentalEnumCatalog.accountStatus.databaseName,
  accountStatusValues
);

export const accountTypeEnum = pgEnum(
  fundamentalEnumCatalog.accountType.databaseName,
  accountTypeValues
);

export const organizationTypeEnum = pgEnum(
  fundamentalEnumCatalog.organizationType.databaseName,
  organizationTypeValues
);

export const caseStatusEnum = pgEnum(
  fundamentalEnumCatalog.caseStatus.databaseName,
  caseStatusValues
);

export const riskLevelEnum = pgEnum(
  fundamentalEnumCatalog.riskLevel.databaseName,
  riskLevelValues
);

export const incidentTypeEnum = pgEnum(
  fundamentalEnumCatalog.incidentType.databaseName,
  incidentTypeValues
);

export const incidentSeverityEnum = pgEnum(
  fundamentalEnumCatalog.incidentSeverity.databaseName,
  incidentSeverityValues
);

export const protectiveOrderTermStatusEnum = pgEnum(
  fundamentalEnumCatalog.protectiveOrderTermStatus.databaseName,
  protectiveOrderTermStatusValues
);

export const protectiveOrderTermTypeEnum = pgEnum(
  fundamentalEnumCatalog.protectiveOrderTermType.databaseName,
  protectiveOrderTermTypeValues
);

export const emergencyAlertStatusEnum = pgEnum(
  fundamentalEnumCatalog.emergencyAlertStatus.databaseName,
  emergencyAlertStatusValues
);

export const alertTriggerTypeEnum = pgEnum(
  fundamentalEnumCatalog.alertTriggerType.databaseName,
  alertTriggerTypeValues
);

export const evidenceTypeEnum = pgEnum(
  fundamentalEnumCatalog.evidenceType.databaseName,
  evidenceTypeValues
);

export const notificationChannelEnum = pgEnum(
  fundamentalEnumCatalog.notificationChannel.databaseName,
  notificationChannelValues
);

export const notificationStatusEnum = pgEnum(
  fundamentalEnumCatalog.notificationStatus.databaseName,
  notificationStatusValues
);
