export const BASE_EXTENSION_NAME = "torque-ai";
export const BASE_PRODUCT_NAME = "Torque AI";
export const PUBLISHER = "Quali";

const PUBLISHER_ID = PUBLISHER.toLowerCase();

export const ENVIRONMENT_DETAILS_TOOL = "torque_get_environment_details";
export const CURRENT_SPACE_TOOL = "get_current_torque_space";

export const BASE_TOOL_NAMES = [ENVIRONMENT_DETAILS_TOOL, CURRENT_SPACE_TOOL];

export const slugOf = (extensionName: string): string =>
  extensionName.replace(/-ai$/, "");

export const platformNameOf = (productName: string): string =>
  productName.replace(/ AI$/, "");

export const toSnakeCase = (slug: string): string => slug.replace(/-/g, "_");

export const toCamelCase = (slug: string): string =>
  slug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

export const BASE_SLUG = slugOf(BASE_EXTENSION_NAME);

export const commandIdFor = (slug: string, commandSuffix: string): string =>
  `${slug}.${commandSuffix}`;

export const identifierFor = (slug: string, suffix: string): string =>
  `${slug}-${suffix}`;

export const providerIdFor = (slug: string): string =>
  `${toCamelCase(slug)}McpProvider`;

export const toolNameFor = (slug: string, baseToolName: string): string =>
  baseToolName.split(toSnakeCase(BASE_SLUG)).join(toSnakeCase(slug));

export const configurationKeyFor = (
  extensionName: string,
  settingKey: string
): string => `${extensionName}.${settingKey}`;

export const extensionIdFor = (extensionName: string): string =>
  `${PUBLISHER_ID}.${extensionName}`;

export const uriActivationEventFor = (extensionName: string): string =>
  `onUri:${extensionIdFor(extensionName)}`;

export const suffixOf = (prefixedId: string): string =>
  prefixedId.slice(prefixedId.indexOf(".") + 1);
