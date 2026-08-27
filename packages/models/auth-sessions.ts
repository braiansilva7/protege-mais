import {
  authSessionDeviceNameMaximumLength,
  authSessionUserAgentMaximumLength,
} from '@protege-mais/common';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
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

const timestampConfiguration = {
  mode: 'date',
  precision: 3,
  withTimezone: true,
} as const;

export const authSessionConstraintNames = Object.freeze({
  accountForeignKey: 'auth_sessions_account_id_fkey',
});

export const authSessionIndexNames = Object.freeze({
  refreshTokenHash: 'auth_sessions_refresh_token_hash_uidx',
  accountLifecycle: 'auth_sessions_account_id_revoked_at_expires_at_idx',
});

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuidV7PrimaryKey(),
    accountId: uuid('account_id').notNull(),
    refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
    deviceIdentifier: varchar('device_identifier', { length: 128 }).notNull(),
    deviceName: varchar('device_name', {
      length: authSessionDeviceNameMaximumLength,
    }),
    ipHash: varchar('ip_hash', { length: 255 }),
    userAgent: varchar('user_agent', {
      length: authSessionUserAgentMaximumLength,
    }),
    expiresAt: timestamp('expires_at', timestampConfiguration).notNull(),
    lastUsedAt: timestamp('last_used_at', timestampConfiguration),
    revokedAt: timestamp('revoked_at', timestampConfiguration),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    version: optimisticLockVersionColumn(),
  },
  (table) => [
    foreignKey({
      name: authSessionConstraintNames.accountForeignKey,
      columns: [table.accountId],
      foreignColumns: [accounts.id],
    })
      .onUpdate('no action')
      .onDelete('restrict'),
    uniqueIndex(authSessionIndexNames.refreshTokenHash).on(
      table.refreshTokenHash
    ),
    index(authSessionIndexNames.accountLifecycle).on(
      table.accountId,
      table.revokedAt,
      table.expiresAt
    ),
    check(
      'auth_sessions_refresh_token_hash_check',
      sql`char_length(${table.refreshTokenHash}) > 0 AND ${table.refreshTokenHash} !~ '[[:space:]]'`
    ),
    check(
      'auth_sessions_device_identifier_check',
      sql`${table.deviceIdentifier} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'`
    ),
    check(
      'auth_sessions_device_name_check',
      sql`${table.deviceName} IS NULL OR (
        char_length(${table.deviceName}) > 0
        AND ${table.deviceName} = btrim(${table.deviceName})
        AND ${table.deviceName} !~ '[[:cntrl:]]'
      )`
    ),
    check(
      'auth_sessions_ip_hash_check',
      sql`${table.ipHash} IS NULL OR (
        char_length(${table.ipHash}) > 0
        AND ${table.ipHash} !~ '[[:space:]]'
      )`
    ),
    check(
      'auth_sessions_user_agent_check',
      sql`${table.userAgent} IS NULL OR (
        char_length(${table.userAgent}) > 0
        AND ${table.userAgent} = btrim(${table.userAgent})
        AND ${table.userAgent} !~ '[[:cntrl:]]'
      )`
    ),
    check(
      'auth_sessions_lifecycle_check',
      sql`${table.expiresAt} > ${table.createdAt}
        AND (
          ${table.lastUsedAt} IS NULL
          OR (
            ${table.lastUsedAt} >= ${table.createdAt}
            AND ${table.lastUsedAt} < ${table.expiresAt}
          )
        )
        AND (
          ${table.revokedAt} IS NULL
          OR ${table.revokedAt} >= ${table.createdAt}
        )
        AND (
          ${table.revokedAt} IS NULL
          OR ${table.lastUsedAt} IS NULL
          OR ${table.lastUsedAt} <= ${table.revokedAt}
        )`
    ),
    check('auth_sessions_version_check', sql`${table.version} > 0`),
  ]
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

export const authSessionPublicSelection = Object.freeze({
  id: authSessions.id,
  deviceIdentifier: authSessions.deviceIdentifier,
  deviceName: authSessions.deviceName,
  userAgent: authSessions.userAgent,
  expiresAt: authSessions.expiresAt,
  lastUsedAt: authSessions.lastUsedAt,
  revokedAt: authSessions.revokedAt,
  createdAt: authSessions.createdAt,
  updatedAt: authSessions.updatedAt,
  version: authSessions.version,
});

export type PublicAuthSession = Readonly<
  Pick<AuthSession, keyof typeof authSessionPublicSelection>
>;

export function serializePublicAuthSession(
  session: AuthSession
): PublicAuthSession {
  return Object.freeze({
    id: session.id,
    deviceIdentifier: session.deviceIdentifier,
    deviceName: session.deviceName,
    userAgent: session.userAgent,
    expiresAt: session.expiresAt,
    lastUsedAt: session.lastUsedAt,
    revokedAt: session.revokedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    version: session.version,
  });
}

export function isAuthSessionActive(
  session: Pick<AuthSession, 'expiresAt' | 'revokedAt'>,
  at: Date
): boolean {
  return (
    session.revokedAt === null && session.expiresAt.getTime() > at.getTime()
  );
}
