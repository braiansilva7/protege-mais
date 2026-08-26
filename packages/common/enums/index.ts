type EnumValues = readonly [string, ...string[]];

function defineEnumValues<const Values extends EnumValues>(
  ...values: Values
): Readonly<Values> {
  return Object.freeze(values);
}

export const accountStatusValues = defineEnumValues(
  'active',
  'blocked',
  'disabled'
);
export type AccountStatus = (typeof accountStatusValues)[number];

export const accountTypeValues = defineEnumValues('person', 'service');
export type AccountType = (typeof accountTypeValues)[number];

export const organizationTypeValues = defineEnumValues(
  'public_agency',
  'nonprofit',
  'private_organization',
  'other'
);
export type OrganizationType = (typeof organizationTypeValues)[number];

export const caseStatusValues = defineEnumValues('open', 'closed');
export type CaseStatus = (typeof caseStatusValues)[number];

export const riskLevelValues = defineEnumValues(
  'low',
  'medium',
  'high',
  'critical'
);
export type RiskLevel = (typeof riskLevelValues)[number];

export const incidentTypeValues = defineEnumValues(
  'physical_violence',
  'psychological_violence',
  'sexual_violence',
  'property_violence',
  'moral_violence',
  'protective_order_breach',
  'other'
);
export type IncidentType = (typeof incidentTypeValues)[number];

export const incidentSeverityValues = defineEnumValues(
  'low',
  'medium',
  'high',
  'critical'
);
export type IncidentSeverity = (typeof incidentSeverityValues)[number];

export const protectiveOrderTermStatusValues = defineEnumValues(
  'active',
  'suspended',
  'revoked',
  'expired'
);
export type ProtectiveOrderTermStatus =
  (typeof protectiveOrderTermStatusValues)[number];

export const protectiveOrderTermTypeValues = defineEnumValues(
  'no_contact',
  'minimum_distance',
  'place_restriction',
  'weapon_restriction',
  'other'
);
export type ProtectiveOrderTermType =
  (typeof protectiveOrderTermTypeValues)[number];

export const emergencyAlertStatusValues = defineEnumValues(
  'received',
  'acknowledged',
  'dispatched',
  'resolved'
);
export type EmergencyAlertStatus = (typeof emergencyAlertStatusValues)[number];

export const alertTriggerTypeValues = defineEnumValues(
  'manual',
  'automatic',
  'external_integration'
);
export type AlertTriggerType = (typeof alertTriggerTypeValues)[number];

export const evidenceTypeValues = defineEnumValues(
  'image',
  'video',
  'audio',
  'document',
  'other'
);
export type EvidenceType = (typeof evidenceTypeValues)[number];

export const notificationChannelValues = defineEnumValues(
  'push',
  'sms',
  'email'
);
export type NotificationChannel = (typeof notificationChannelValues)[number];

export const notificationStatusValues = defineEnumValues(
  'pending',
  'processing',
  'sent',
  'delivered',
  'failed'
);
export type NotificationStatus = (typeof notificationStatusValues)[number];

function defineEnumDefinition<
  const DatabaseName extends string,
  const Values extends EnumValues,
>(databaseName: DatabaseName, values: Values) {
  return Object.freeze({ databaseName, values });
}

export const fundamentalEnumCatalog = Object.freeze({
  accountStatus: defineEnumDefinition('account_status', accountStatusValues),
  accountType: defineEnumDefinition('account_type', accountTypeValues),
  organizationType: defineEnumDefinition(
    'organization_type',
    organizationTypeValues
  ),
  caseStatus: defineEnumDefinition('case_status', caseStatusValues),
  riskLevel: defineEnumDefinition('risk_level', riskLevelValues),
  incidentType: defineEnumDefinition('incident_type', incidentTypeValues),
  incidentSeverity: defineEnumDefinition(
    'incident_severity',
    incidentSeverityValues
  ),
  protectiveOrderTermStatus: defineEnumDefinition(
    'protective_order_term_status',
    protectiveOrderTermStatusValues
  ),
  protectiveOrderTermType: defineEnumDefinition(
    'protective_order_term_type',
    protectiveOrderTermTypeValues
  ),
  emergencyAlertStatus: defineEnumDefinition(
    'emergency_alert_status',
    emergencyAlertStatusValues
  ),
  alertTriggerType: defineEnumDefinition(
    'alert_trigger_type',
    alertTriggerTypeValues
  ),
  evidenceType: defineEnumDefinition('evidence_type', evidenceTypeValues),
  notificationChannel: defineEnumDefinition(
    'notification_channel',
    notificationChannelValues
  ),
  notificationStatus: defineEnumDefinition(
    'notification_status',
    notificationStatusValues
  ),
});

export type FundamentalEnumKey = keyof typeof fundamentalEnumCatalog;
