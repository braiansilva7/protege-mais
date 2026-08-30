import {
  organizationMemberJobTitleMaximumLength,
  organizationMemberRegistrationNumberMaximumLength,
} from '@protege-mais/common';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import {
  createdAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from './columns.js';
import { organizationUnits } from './organization-units.js';
import { organizations } from './organizations.js';

export const organizationMemberConstraintNames = Object.freeze({
  membershipContextUnique: 'organization_members_account_organization_unit_key',
  accountForeignKey: 'organization_members_account_id_fkey',
  organizationForeignKey: 'organization_members_organization_id_fkey',
  organizationUnitForeignKey:
    'organization_members_organization_unit_context_fkey',
  registrationNumber: 'organization_members_registration_number_check',
  jobTitle: 'organization_members_job_title_check',
  version: 'organization_members_version_check',
});

export const organizationMemberIndexNames = Object.freeze({
  activeAccountContext: 'organization_members_account_context_active_idx',
  organizationUnit: 'organization_members_organization_unit_idx',
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuidV7PrimaryKey(),
    accountId: uuid('account_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    organizationUnitId: uuid('organization_unit_id'),
    registrationNumber: varchar('registration_number', {
      length: organizationMemberRegistrationNumberMaximumLength,
    }),
    jobTitle: varchar('job_title', {
      length: organizationMemberJobTitleMaximumLength,
    }),
    isActive: boolean('is_active').notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
  },
  (table) => [
    unique(organizationMemberConstraintNames.membershipContextUnique)
      .on(table.accountId, table.organizationId, table.organizationUnitId)
      .nullsNotDistinct(),
    foreignKey({
      name: organizationMemberConstraintNames.accountForeignKey,
      columns: [table.accountId],
      foreignColumns: [accounts.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    foreignKey({
      name: organizationMemberConstraintNames.organizationForeignKey,
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    foreignKey({
      name: organizationMemberConstraintNames.organizationUnitForeignKey,
      columns: [table.organizationId, table.organizationUnitId],
      foreignColumns: [organizationUnits.organizationId, organizationUnits.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    index(organizationMemberIndexNames.activeAccountContext)
      .on(table.accountId, table.organizationId, table.organizationUnitId)
      .where(sql`${table.isActive}`),
    index(organizationMemberIndexNames.organizationUnit).on(
      table.organizationId,
      table.organizationUnitId
    ),
    check(
      organizationMemberConstraintNames.registrationNumber,
      sql`${table.registrationNumber} IS NULL OR (
        char_length(${table.registrationNumber}) > 0
        AND ${table.registrationNumber} = btrim(${table.registrationNumber})
        AND ${table.registrationNumber} !~ '[[:cntrl:]]'
        AND ${table.registrationNumber} !~ '[[:space:]]{2,}'
      )`
    ),
    check(
      organizationMemberConstraintNames.jobTitle,
      sql`${table.jobTitle} IS NULL OR (
        char_length(${table.jobTitle}) > 0
        AND ${table.jobTitle} = btrim(${table.jobTitle})
        AND ${table.jobTitle} !~ '[[:cntrl:]]'
        AND ${table.jobTitle} !~ '[[:space:]]{2,}'
      )`
    ),
    check(organizationMemberConstraintNames.version, sql`${table.version} > 0`),
  ]
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export const organizationMemberPublicSelection = Object.freeze({
  id: organizationMembers.id,
  accountId: organizationMembers.accountId,
  organizationId: organizationMembers.organizationId,
  organizationUnitId: organizationMembers.organizationUnitId,
  jobTitle: organizationMembers.jobTitle,
  isActive: organizationMembers.isActive,
  createdAt: organizationMembers.createdAt,
  updatedAt: organizationMembers.updatedAt,
  version: organizationMembers.version,
});

export type PublicOrganizationMember = Readonly<
  Pick<OrganizationMember, keyof typeof organizationMemberPublicSelection>
>;

export function serializePublicOrganizationMember(
  member: OrganizationMember
): PublicOrganizationMember {
  return Object.freeze({
    id: member.id,
    accountId: member.accountId,
    organizationId: member.organizationId,
    organizationUnitId: member.organizationUnitId,
    jobTitle: member.jobTitle,
    isActive: member.isActive,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    version: member.version,
  });
}

/** Indica somente a vigência local; não substitui a decisão de autorização. */
export function isOrganizationMemberActive(
  member: Pick<OrganizationMember, 'isActive'>
): boolean {
  return member.isActive;
}
