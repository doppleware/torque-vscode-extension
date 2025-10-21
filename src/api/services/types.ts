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

export interface BlueprintValidationRequest {
  blueprint_name: string;
  blueprint_raw_64: string;
}

export interface BlueprintValidationError {
  message: string;
  name?: string;
  code?: string;
  line?: number;
  column?: number;
  path?: string;
}

export interface BlueprintValidationResponse {
  errors: BlueprintValidationError[];
  warnings?: BlueprintValidationError[];
}

export interface CatalogInputDefaultValue {
  type: string;
  value: string;
}

export interface CatalogInput {
  name: string;
  type: string;
  style: string;
  default_value: string | null;
  default_value_v2: CatalogInputDefaultValue | null;
  has_default_value: boolean;
  sensitive: boolean;
  description: string | null;
  allowed_values: string[];
  parameter_name: string | null;
  pattern: string | null;
  validation_description: string | null;
  depends_on: string[];
  source_name: string | null;
  overrides: unknown[];
  max_size_in_mb: number | null;
  max_files: number | null;
  allowed_formats: string[];
}

export interface CatalogAssetDetails {
  name: string;
  display_name: string;
  repository_branch: string | null;
  commit: string | null;
  url: string | null;
  repository_url: string | null;
  repository_name: string;
  relative_path: string | null;
  is_editable: boolean;
  description: string;
  instructions: string | null;
  layout: unknown;
  spec: string;
  last_modified: string;
  modified_by: string;
  inputs: CatalogInput[];
  outputs: unknown[];
  environment_labels: unknown[];
  env_references: unknown[];
  icon: string;
  color: string | null;
  favorite: boolean;
  custom_icon: unknown;
  labels: unknown[];
  enabled: boolean;
  is_approval_required: boolean;
  cost: number | null;
  num_of_active_environments: number;
}

export interface CatalogTag {
  name: string;
  default_value: string;
  possible_values: string[];
  description: string;
}

export interface CatalogPolicies {
  max_duration: string | null;
  default_duration: string;
  default_extend: string;
  max_active_environments: number | null;
  always_on: boolean;
  allow_scheduling: boolean;
}

export interface CatalogAssetResponse {
  details: CatalogAssetDetails;
  tags: CatalogTag[];
  policies: CatalogPolicies;
}

export interface IntrospectionResource {
  name: string;
  type: string;
  dependency_identifier: string;
  attributes?: Record<string, string>;
  tags?: Record<string, string>;
  depends_on?: string[];
}

export interface IntrospectionResponse {
  resources: IntrospectionResource[];
  errors: unknown[];
}
