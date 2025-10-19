export interface UserSession {
  accessToken: string;
  refreshToken: string;
  expiration: string;
  userId: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export type LoginResponse = UserSession;

export interface RefreshTokenPayload {
  accessToken: string;
  refreshToken: string;
}

export type RefreshTokenResponse = UserSession;

export interface Space {
  name: string;
  description?: string;
}
