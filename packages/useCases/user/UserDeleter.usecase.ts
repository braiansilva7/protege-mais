import { inject, injectable } from 'tsyringe';
import type { User } from '@core/common/types/user.js';
import { UserService } from '@core/services/user.service.js';

@injectable()
export class UserDeleterUseCase {
  constructor(@inject(UserService) private readonly userService: UserService) {}

  execute(id: string, authenticatedUser: User) {
    return this.userService.delete(id, authenticatedUser);
  }
}
