import { inject, injectable } from 'tsyringe';
import { UserService } from '@core/services/user.service.js';

@injectable()
export class UserListerUseCase {
  constructor(@inject(UserService) private readonly userService: UserService) {}

  execute() {
    return this.userService.list();
  }
}
