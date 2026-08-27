export const permissionCatalog = Object.freeze({
  account: Object.freeze([
    'account.list',
    'account.view',
    'account.create',
    'account.update',
    'account.disable',
  ] as const),
  organization: Object.freeze([
    'organization.list',
    'organization.view',
    'organization.create',
    'organization.update',
  ] as const),
  victim: Object.freeze([
    'victim.list',
    'victim.view',
    'victim.create',
    'victim.update',
  ] as const),
  case: Object.freeze([
    'case.list',
    'case.view',
    'case.create',
    'case.update',
    'case.close',
    'case.transfer',
  ] as const),
});

export const permissionCodes = Object.freeze([
  ...permissionCatalog.account,
  ...permissionCatalog.organization,
  ...permissionCatalog.victim,
  ...permissionCatalog.case,
] as const);

export type PermissionResource = keyof typeof permissionCatalog;
export type PermissionCode = (typeof permissionCodes)[number];

const knownPermissionCodes: ReadonlySet<string> = new Set(permissionCodes);

export function isPermissionCode(value: string): value is PermissionCode {
  return knownPermissionCodes.has(value);
}
