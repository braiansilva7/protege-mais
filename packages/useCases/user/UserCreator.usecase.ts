import { inject, injectable } from 'tsyringe';
import type { ICreateUserInput } from '@core/interfaces/user/ICreateUserInput.js';
import { UserService } from '@core/services/user.service.js';

@injectable()
export class UserCreatorUseCase {
  constructor(@inject(UserService) private readonly userService: UserService) {}

  execute(input: ICreateUserInput) {
    return this.userService.create(input);
  }
}
