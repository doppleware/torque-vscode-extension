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

export interface CustomIcon {
  file_name: string;
  file_byte_size: number;
  url: string;
  key: string;
}

export interface Label {
  name: string;
  color: string;
}

export interface IacAsset {
  name: string;
  iac_resource_type: string;
  path: string;
  repository_type: string;
  repository: string;
  repository_url: string;
  branch: string;
  icon?: string;
  custom_icon?: CustomIcon;
  labels?: Label[];
  in_catalog?: boolean;
  in_designer_library?: boolean;
  average_hourly_cost?: number;
  link?: string;
  in_error?: boolean;
  blueprint_count?: number;
  workflow_count?: number;
  environment_count?: number;
  total_usage_count?: number;
}

export interface PagingInfo {
  full_count: number;
  requested_page: number;
  total_pages: number;
}

export interface IacAssetsResponse {
  iac_assets: IacAsset[];
  paging_info: PagingInfo;
}
