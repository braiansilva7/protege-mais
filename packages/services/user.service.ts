import { inject, injectable } from 'tsyringe';
import {
  hashPassword,
  verifyPassword,
} from '@core/common/functions/password.js';
import type { User, UserListItem } from '@core/common/types/user.js';
import type { ICreateUserInput } from '@core/interfaces/user/ICreateUserInput.js';
import type { IUpdateUserInput } from '@core/interfaces/user/IUpdateUserInput.js';
import { UserRepository } from '@core/repositories/user/user.repository.js';
import { StorageService } from '@core/services/storage.service.js';

@injectable()
export class UserService {
  constructor(
    @inject(UserRepository) private readonly userRepository: UserRepository,
    @inject(StorageService) private readonly storageService: StorageService
  ) {}

  list(): Promise<UserListItem[]> {
    return this.userRepository.list();
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async create(input: ICreateUserInput): Promise<UserListItem> {
    let profilePictureUrl: string | null = null;
    if (input.profilePicture) {
      profilePictureUrl = await this.storageService.uploadProfilePicture(
        input.profilePicture
      );
    }

    return this.userRepository.create({
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      permissionRoleId: input.permissionRoleId,
      languageCode: input.languageCode,
      countryId: input.countryId ?? null,
      profilePictureUrl,
      active: input.active,
    });
  }

  async update(id: string, input: IUpdateUserInput, authenticatedUser: User) {
    if (
      id === authenticatedUser.id &&
      (input.active === false || input.permissionRoleId !== undefined)
    ) {
      return { error: 'SELF_ADMIN_CHANGE' as const };
    }

    const current = await this.userRepository.findById(id);
    if (!current) return { user: null };

    let profilePictureUrl = current.profilePictureUrl;
    if (input.profilePicture) {
      profilePictureUrl = await this.storageService.uploadProfilePicture(
        input.profilePicture
      );
      await this.storageService.deleteByUrl(current.profilePictureUrl);
    }

    const user = await this.userRepository.update(id, {
      username: input.username,
      email: input.email,
      passwordHash: input.password
        ? await hashPassword(input.password)
        : undefined,
      permissionRoleId: input.permissionRoleId,
      languageCode: input.languageCode,
      countryId: input.countryId,
      profilePictureUrl: input.profilePicture ? profilePictureUrl : undefined,
      active: input.active,
    });

    return { user };
  }

  async delete(id: string, authenticatedUser: User) {
    if (id === authenticatedUser.id) return { error: 'SELF_DELETE' as const };
    const current = await this.userRepository.findById(id);
    if (!current) return { deleted: false };
    const deleted = await this.userRepository.delete(id);
    if (deleted)
      await this.storageService.deleteByUrl(current.profilePictureUrl);
    return { deleted };
  }
}

@injectable()
export class AuthService {
  constructor(@inject(UserService) private readonly userService: UserService) {}

  async login(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    const passwordMatches = user
      ? await verifyPassword(password, user.passwordHash)
      : false;
    return user && user.active && passwordMatches ? user : null;
  }
}
