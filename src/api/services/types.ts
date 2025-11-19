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

export interface EnvironmentOwner {
  first_name: string;
  last_name: string;
  timezone: string;
  email: string;
  join_date: string;
  display_first_name: string;
  display_last_name: string;
}

export interface EnvironmentMetadata {
  name: string;
  space_name: string;
  automation: boolean;
  eac_url: string | null;
  blueprint: string;
  blueprint_name: string;
  blueprint_display_name: string;
  blueprint_commit: string;
  is_attached: boolean;
  repository_name: string;
  blueprint_branch: string | null;
  blueprint_folder: string | null;
  inline_blueprint: boolean;
}

export interface Environment {
  id: string;
  owner: EnvironmentOwner;
  initiator: EnvironmentOwner;
  details: {
    definition: {
      metadata: EnvironmentMetadata;
    };
  };
}

export interface EnvironmentListResponse {
  environment_list: Environment[];
  paging_info: {
    full_count: number;
    requested_page: number;
    total_pages: number;
  };
  active_environments: number;
  user_environments: number;
  environments_with_errors: number;
  always_on_environments: number;
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

export interface WorkflowInput {
  name: string;
  value: string | null;
  type: string;
  allowed_values: string[];
}

export interface WorkflowInstantiation {
  id: string;
  name: string;
  scope: string;
  inputs: WorkflowInput[];
  env_references: unknown[];
  blueprint_name: string;
  blueprint_store: string;
  triggers: unknown[];
  enabled: boolean;
}

export interface WorkflowsResponse {
  instantiations: WorkflowInstantiation[];
}

// Deploy types
export interface InputDefinition {
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

export interface AllowedValuesRequest {
  input_values: Record<string, string>;
  input_definitions: InputDefinition[];
}

export interface AllowedValueExtraDetails {
  agent_type?: string;
  quali_owned?: boolean;
  status?: string;
  details_type?: string;
  [key: string]: unknown;
}

export interface AllowedValue {
  value: string;
  display_value: string | null;
  extra_details: AllowedValueExtraDetails;
}

export interface AllowedValuesResponseItem {
  errors: string[];
  name: string;
  allowed_values: AllowedValue[];
}

export type AllowedValuesResponse = AllowedValuesResponseItem[];

export interface DeployEnvironmentRequest {
  environment_name: string;
  blueprint_name: string;
  inputs: Record<string, string>;
  duration?: string;
  automation?: boolean;
  description?: string;
  base64_standalone_blueprint?: string;
}

export interface DeployEnvironmentResponse {
  id: string;
  ticket_id: string | null;
}
