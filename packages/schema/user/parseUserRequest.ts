import type { FastifyRequest } from 'fastify';
import type { LanguageCode } from '@core/common/types/user.js';
import type { ICreateUserInput } from '@core/interfaces/user/ICreateUserInput.js';
import type { IProfilePicture } from '@core/interfaces/user/IProfilePicture.js';
import type { IUpdateUserInput } from '@core/interfaces/user/IUpdateUserInput.js';

const languageCodes = new Set(['pt-BR', 'en', 'es']);

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  const raw = asString(value);
  if (raw === undefined) {
    if (typeof value === 'boolean') return value;
    return undefined;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

function parseLanguage(value: unknown): LanguageCode | undefined {
  const raw = asString(value);
  return raw && languageCodes.has(raw) ? (raw as LanguageCode) : undefined;
}

export async function parseUserMultipart(request: FastifyRequest): Promise<{
  fields: Record<string, unknown>;
  profilePicture: IProfilePicture | null;
}> {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return {
      fields: (request.body as Record<string, unknown>) ?? {},
      profilePicture: null,
    };
  }

  const fields: Record<string, unknown> = {};
  let profilePicture: IProfilePicture | null = null;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (
        part.fieldname === 'profile_picture' ||
        part.fieldname === 'profilePicture'
      ) {
        const buffer = await part.toBuffer();
        if (buffer.length > 0) {
          profilePicture = {
            buffer,
            mimeType: part.mimetype,
            originalName: part.filename || 'profile.bin',
          };
        }
      } else {
        await part.toBuffer();
      }
    } else {
      fields[part.fieldname] = part.value;
    }
  }

  return { fields, profilePicture };
}

export function parseCreateUserInput(
  fields: Record<string, unknown>,
  profilePicture: IProfilePicture | null
): ICreateUserInput | null {
  const username = asString(fields.username)?.trim();
  const email = asString(fields.email)?.trim();
  const password = asString(fields.password);
  const permissionRoleId = asString(
    fields.permission_role_id ?? fields.permissionRoleId
  );
  const languageCode = parseLanguage(
    fields.language_code ?? fields.languageCode
  );
  if (
    !username ||
    username.length < 3 ||
    !email ||
    !password ||
    password.length < 8 ||
    !permissionRoleId ||
    !languageCode
  ) {
    return null;
  }

  const countryIdRaw = asString(fields.country_id ?? fields.countryId);
  const active = asBoolean(fields.active);

  return {
    username,
    email,
    password,
    permissionRoleId,
    languageCode,
    countryId: countryIdRaw === '' ? null : countryIdRaw,
    active,
    profilePicture,
  };
}

export function parseUpdateUserInput(
  fields: Record<string, unknown>,
  profilePicture: IProfilePicture | null
): IUpdateUserInput | null {
  const input: IUpdateUserInput = {};
  const username = asString(fields.username)?.trim();
  const email = asString(fields.email)?.trim();
  const password = asString(fields.password);
  const permissionRoleId = asString(
    fields.permission_role_id ?? fields.permissionRoleId
  );
  const languageCode = parseLanguage(
    fields.language_code ?? fields.languageCode
  );
  const countryIdRaw =
    fields.country_id !== undefined || fields.countryId !== undefined
      ? asString(fields.country_id ?? fields.countryId)
      : undefined;
  const active = asBoolean(fields.active);

  if (username !== undefined) input.username = username;
  if (email !== undefined) input.email = email;
  if (password !== undefined) input.password = password;
  if (permissionRoleId !== undefined) input.permissionRoleId = permissionRoleId;
  if (languageCode !== undefined) input.languageCode = languageCode;
  if (countryIdRaw !== undefined)
    input.countryId = countryIdRaw === '' ? null : countryIdRaw;
  if (active !== undefined) input.active = active;
  if (profilePicture) input.profilePicture = profilePicture;

  return Object.keys(input).length ? input : null;
}

export function parseUserId(params: unknown): string | null {
  if (!params || typeof params !== 'object' || !('id' in params)) return null;
  const id = (params as { id: unknown }).id;
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
