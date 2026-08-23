import { and, eq, inArray } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
  PermissionAction,
  PermissionRole,
} from '@core/common/types/permission.js';
import type { AppDatabase } from '@core/plugins/database/index.js';
import {
  permissionAssignments,
  permissionRoleActions,
  permissionRoles,
  permissions,
} from '@core/models/permission/permission.model.js';
import { permissionActions } from '@core/common/types/permission.js';
import { createUuidV7 } from '@core/common/functions/uuid.js';

@injectable()
export class PermissionRepository {
  constructor(@inject('DatabaseRw') private readonly db: AppDatabase) {}
  async roleForUser(userId: string): Promise<PermissionRole | null> {
    const rows = await this.db
      .select({
        id: permissionRoles.id,
        code: permissionRoles.code,
        name: permissionRoles.name,
        description: permissionRoles.description,
        isSystem: permissionRoles.is_system,
        active: permissionRoles.active,
        action: permissionRoleActions.action,
      })
      .from(permissionAssignments)
      .innerJoin(
        permissionRoles,
        eq(permissionAssignments.permission_role_id, permissionRoles.id)
      )
      .leftJoin(
        permissionRoleActions,
        eq(permissionRoleActions.permission_role_id, permissionRoles.id)
      )
      .where(eq(permissionAssignments.user_id, userId));
    if (!rows.length) return null;
    const first = rows[0];
    return {
      id: first.id,
      code: first.code,
      name: first.name,
      description: first.description,
      isSystem: first.isSystem,
      active: first.active,
      permissions: rows.flatMap((row) =>
        row.action ? [row.action as PermissionAction] : []
      ),
    };
  }
  async assign(userId: string, roleId: string) {
    await this.db
      .insert(permissionAssignments)
      .values({ user_id: userId, permission_role_id: roleId })
      .onConflictDoUpdate({
        target: permissionAssignments.user_id,
        set: {
          permission_role_id: roleId,
          updated_at: new Date().toISOString(),
        },
      });
  }
  async hasUsers(roleId: string) {
    return (
      (
        await this.db
          .select({ id: permissionAssignments.user_id })
          .from(permissionAssignments)
          .where(eq(permissionAssignments.permission_role_id, roleId))
          .limit(1)
      ).length > 0
    );
  }
  async list(): Promise<PermissionRole[]> {
    const rows = await this.db
      .select({
        id: permissionRoles.id,
        code: permissionRoles.code,
        name: permissionRoles.name,
        description: permissionRoles.description,
        isSystem: permissionRoles.is_system,
        active: permissionRoles.active,
        action: permissionRoleActions.action,
      })
      .from(permissionRoles)
      .leftJoin(
        permissionRoleActions,
        eq(permissionRoleActions.permission_role_id, permissionRoles.id)
      );
    const result = new Map<string, PermissionRole>();
    for (const row of rows) {
      const role = result.get(row.id) ?? {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        isSystem: row.isSystem,
        active: row.active,
        permissions: [],
      };
      if (row.action) role.permissions.push(row.action as PermissionAction);
      result.set(row.id, role);
    }
    return [...result.values()];
  }
  async find(roleId: string) {
    return (await this.list()).find((role) => role.id === roleId) ?? null;
  }
  async create(input: {
    name: string;
    description?: string | null;
    permissions: PermissionAction[];
  }) {
    const [role] = await this.db
      .insert(permissionRoles)
      .values({ id: createUuidV7(), name: input.name, description: input.description ?? null })
      .returning();
    await this.setActions(role.id, input.permissions);
    return this.find(role.id);
  }
  async update(
    roleId: string,
    input: { name?: string; description?: string | null; active?: boolean }
  ) {
    await this.db
      .update(permissionRoles)
      .set({ ...input, updated_at: new Date().toISOString() })
      .where(eq(permissionRoles.id, roleId));
    return this.find(roleId);
  }
  async setActions(roleId: string, actions: PermissionAction[]) {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(permissionRoleActions)
        .where(eq(permissionRoleActions.permission_role_id, roleId));
      if (actions.length)
        await tx
          .insert(permissionRoleActions)
          .values(
            actions.map((action) => ({ permission_role_id: roleId, action }))
          );
    });
    return this.find(roleId);
  }
  async remove(roleId: string) {
    await this.db.delete(permissionRoles).where(eq(permissionRoles.id, roleId));
  }
  async actions() {
    return [...permissionActions];
  }
}
