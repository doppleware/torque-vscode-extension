import type vscode from "vscode";

export const MCP_SERVER_NAME = "torque";
export const MCP_SERVER_LABEL = "torque";
export const MCP_SERVER_PROVIDER_ID = "torqueMcpProvider";

const FALLBACK_CONFIGURATION_SECTION = "torque-ai";

let configurationSection = FALLBACK_CONFIGURATION_SECTION;

export const initializeBranding = (context: vscode.ExtensionContext): void => {
  const packageJson = context.extension.packageJSON as { name?: string };

  if (packageJson.name) {
    configurationSection = packageJson.name;
  }
};

export const getConfigurationSection = (): string => configurationSection;

export const getConfigurationKey = (settingKey: string): string =>
  `${configurationSection}.${settingKey}`;
