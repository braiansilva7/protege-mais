import type { AuthenticatedUser } from './user';

export interface LoginResponse {
  access_token: string;
  user: AuthenticatedUser;
}

export interface ApiMessage {
  message?: string;
}
