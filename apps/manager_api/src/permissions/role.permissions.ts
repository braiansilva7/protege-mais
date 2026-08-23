import type { PermissionAction } from '@core/common/types/permission.js';
export const roleViewPermissions: PermissionAction[] = ['roles.view'];
export const roleCreatePermissions: PermissionAction[] = ['roles.create'];
export const roleEditPermissions: PermissionAction[] = ['roles.update'];
export const roleDeletePermissions: PermissionAction[] = ['roles.delete'];
export const rolePermissionsUpdatePermissions: PermissionAction[] = [
  'roles.permissions',
];
