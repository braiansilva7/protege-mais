import { inject, injectable } from 'tsyringe';
import { AuthService } from '@core/services/user.service.js';

@injectable()
export class LoginUseCase {
  constructor(@inject(AuthService) private readonly authService: AuthService) {}

  execute(email: string, password: string) {
    return this.authService.login(email, password);
  }
}
