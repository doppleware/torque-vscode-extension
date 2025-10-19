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

export interface Repository {
  name: string;
  repository_url?: string;
  branch?: string;
  repository_type?: string;
  status?: string;
  last_synced?: string;
  credentials?: string;
  space_name?: string | null;
  eac_auto_registration?: boolean;
}
