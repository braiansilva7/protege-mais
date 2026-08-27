import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  createdAtColumn,
  deletedAtColumn,
  optimisticLockVersionColumn,
  updatedAtColumn,
  uuidV7PrimaryKey,
} from './columns.js';
import { accountStatusEnum, accountTypeEnum } from './enums.js';

export const accountActiveIdentifierIndexNames = Object.freeze({
  email: 'accounts_email_normalized_active_uidx',
  phoneE164: 'accounts_phone_e164_active_uidx',
  externalIdentity: 'accounts_external_provider_external_subject_active_uidx',
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuidV7PrimaryKey(),
    email: varchar('email', { length: 320 }),
    emailNormalized: varchar('email_normalized', { length: 320 }),
    phoneE164: varchar('phone_e164', { length: 16 }),
    passwordHash: text('password_hash'),
    externalProvider: varchar('external_provider', { length: 63 }),
    externalSubject: varchar('external_subject', { length: 255 }),
    type: accountTypeEnum('type').notNull(),
    status: accountStatusEnum('status').notNull(),
    mfaEnabled: boolean('mfa_enabled').notNull(),
    lastLoginAt: timestamp('last_login_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    uniqueIndex(accountActiveIdentifierIndexNames.email)
      .on(table.emailNormalized)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.emailNormalized} IS NOT NULL`
      ),
    uniqueIndex(accountActiveIdentifierIndexNames.phoneE164)
      .on(table.phoneE164)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.phoneE164} IS NOT NULL`
      ),
    uniqueIndex(accountActiveIdentifierIndexNames.externalIdentity)
      .on(table.externalProvider, table.externalSubject)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.externalProvider} IS NOT NULL AND ${table.externalSubject} IS NOT NULL`
      ),
    check(
      'accounts_email_normalization_check',
      sql`(
        (${table.email} IS NULL AND ${table.emailNormalized} IS NULL)
        OR (
          ${table.email} IS NOT NULL
          AND ${table.emailNormalized} IS NOT NULL
          AND ${table.email} = btrim(${table.email})
          AND ${table.emailNormalized} = lower(${table.email})
          AND ${table.emailNormalized} ~ '^[^@[:space:]]+@[^@[:space:]]+$'
        )
      )`
    ),
    check(
      'accounts_phone_e164_check',
      sql`${table.phoneE164} IS NULL OR ${table.phoneE164} ~ '^\\+[1-9][0-9]{1,14}$'`
    ),
    check(
      'accounts_password_hash_check',
      sql`${table.passwordHash} IS NULL OR char_length(${table.passwordHash}) > 0`
    ),
    check(
      'accounts_external_identity_check',
      sql`(
        ${table.externalProvider} IS NULL
        AND ${table.externalSubject} IS NULL
      ) OR (
        ${table.externalProvider} IS NOT NULL
        AND ${table.externalSubject} IS NOT NULL
        AND ${table.externalProvider} = lower(btrim(${table.externalProvider}))
        AND ${table.externalProvider} ~ '^[a-z][a-z0-9_-]{0,62}$'
        AND char_length(${table.externalSubject}) > 0
      )`
    ),
    check(
      'accounts_identity_method_check',
      sql`(
        ${table.emailNormalized} IS NOT NULL
        AND ${table.passwordHash} IS NOT NULL
      ) OR (
        ${table.externalProvider} IS NOT NULL
        AND ${table.externalSubject} IS NOT NULL
      )`
    ),
    check('accounts_version_check', sql`${table.version} > 0`),
  ]
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export const accountPublicSelection = Object.freeze({
  id: accounts.id,
  email: accounts.email,
  phoneE164: accounts.phoneE164,
  externalProvider: accounts.externalProvider,
  type: accounts.type,
  status: accounts.status,
  mfaEnabled: accounts.mfaEnabled,
  lastLoginAt: accounts.lastLoginAt,
  createdAt: accounts.createdAt,
  updatedAt: accounts.updatedAt,
  version: accounts.version,
});

export type PublicAccount = Readonly<
  Pick<Account, keyof typeof accountPublicSelection>
>;

export function serializePublicAccount(account: Account): PublicAccount {
  return Object.freeze({
    id: account.id,
    email: account.email,
    phoneE164: account.phoneE164,
    externalProvider: account.externalProvider,
    type: account.type,
    status: account.status,
    mfaEnabled: account.mfaEnabled,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    version: account.version,
  });
}
