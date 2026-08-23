import type { PermissionAction } from '@core/common/types/permission.js';
export const authenticatedPermissions: PermissionAction[] = [];
export const userViewPermissions: PermissionAction[] = ['users.view'];
export const userCreatePermissions: PermissionAction[] = ['users.create'];
export const userUpdatePermissions: PermissionAction[] = ['users.update'];
export const userDeletePermissions: PermissionAction[] = ['users.delete'];
