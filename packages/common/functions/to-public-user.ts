import type { User, PublicUser } from '@core/common/types/user.js';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    permission_role_id: user.permissionRoleId,
    permission_role: user.permissionRole
      ? {
          id: user.permissionRole.id,
          name: user.permissionRole.name,
          code: user.permissionRole.code,
          is_system: user.permissionRole.isSystem,
          active: user.permissionRole.active,
        }
      : undefined,
    permissions: user.permissions,
    country_id: user.countryId,
    language_code: user.languageCode,
    profile_picture_url: user.profilePictureUrl,
    total_score: user.totalScore,
    active: user.active,
    created_at: user.createdAt,
  };
}
