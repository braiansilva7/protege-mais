import { inject, injectable } from 'tsyringe';
import type { User } from '@core/common/types/user.js';
import type { IUpdateUserInput } from '@core/interfaces/user/IUpdateUserInput.js';
import { UserService } from '@core/services/user.service.js';

@injectable()
export class UserUpdaterUseCase {
  constructor(@inject(UserService) private readonly userService: UserService) {}

  execute(id: string, input: IUpdateUserInput, authenticatedUser: User) {
    return this.userService.update(id, input, authenticatedUser);
  }
}
