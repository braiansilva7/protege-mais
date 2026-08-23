import { inject, injectable } from 'tsyringe';
import { eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '@core/plugins/database/index.js';
import { users } from '@core/models/user/user.model.js';
import type {
  LanguageCode,
  User,
  UserListItem,
} from '@core/common/types/user.js';
import { PermissionRepository } from '@core/repositories/permission/permission.repository.js';
import { toPublicUser } from '@core/common/functions/to-public-user.js';
import { createUuidV7 } from '@core/common/functions/uuid.js';

function mapLanguage(value: string): LanguageCode {
  return value === 'en' || value === 'es' ? value : 'pt-BR';
}

async function mapUser(
  row: typeof users.$inferSelect,
  permissions: PermissionRepository
): Promise<User> {
  const permissionRole = await permissions.roleForUser(row.id);
  if (!permissionRole) throw new Error('User permission assignment not found');
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    permissionRoleId: permissionRole.id,
    permissionRole,
    permissions: permissionRole.permissions,
    countryId: row.country_id,
    languageCode: mapLanguage(row.language_code),
    profilePictureUrl: row.profile_picture_url,
    totalScore: row.total_score,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@injectable()
export class UserRepository {
  constructor(
    @inject('DatabaseRw') private readonly db: AppDatabase,
    @inject(PermissionRepository)
    private readonly permissions: PermissionRepository
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return rows[0] ? mapUser(rows[0], this.permissions) : null;
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ? mapUser(rows[0], this.permissions) : null;
  }

  async list(): Promise<UserListItem[]> {
    const rows = await this.db
      .select()
      .from(users)
      .orderBy(sql`${users.created_at} DESC`, users.username);
    return Promise.all(
      rows.map(async (row) =>
        toPublicUser(await mapUser(row, this.permissions))
      )
    );
  }

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
    permissionRoleId: string;
    languageCode: LanguageCode;
    countryId?: string | null;
    profilePictureUrl?: string | null;
    active?: boolean;
  }): Promise<UserListItem> {
    const [row] = await this.db
      .insert(users)
      .values({
        id: createUuidV7(),
        username: input.username,
        email: input.email.toLowerCase(),
        password_hash: input.passwordHash,
        language_code: input.languageCode,
        country_id: input.countryId ?? null,
        profile_picture_url: input.profilePictureUrl ?? null,
        active: input.active ?? true,
      })
      .returning();
    await this.permissions.assign(row.id, input.permissionRoleId);
    return toPublicUser(await mapUser(row, this.permissions));
  }

  async update(
    id: string,
    input: Partial<{
      username: string;
      email: string;
      passwordHash: string;
      permissionRoleId: string;
      languageCode: LanguageCode;
      countryId: string | null;
      profilePictureUrl: string | null;
      active: boolean;
    }>
  ): Promise<UserListItem | null> {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (input.username !== undefined) patch.username = input.username;
    if (input.email !== undefined) patch.email = input.email.toLowerCase();
    if (input.passwordHash !== undefined)
      patch.password_hash = input.passwordHash;
    if (input.languageCode !== undefined)
      patch.language_code = input.languageCode;
    if (input.countryId !== undefined) patch.country_id = input.countryId;
    if (input.profilePictureUrl !== undefined)
      patch.profile_picture_url = input.profilePictureUrl;
    if (input.active !== undefined) patch.active = input.active;
    if (!Object.keys(patch).length) return null;

    const [row] = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();
    if (!row) return null;
    if (input.permissionRoleId !== undefined)
      await this.permissions.assign(id, input.permissionRoleId);
    return toPublicUser(await mapUser(row, this.permissions));
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return deleted.length === 1;
  }
}
