import type vscode from "vscode";

import {
  BASE_EXTENSION_NAME,
  BASE_PRODUCT_NAME,
  commandIdFor,
  configurationKeyFor,
  extensionIdFor,
  identifierFor,
  platformNameOf,
  providerIdFor,
  slugOf,
  toolNameFor
} from "./brandNaming";

type Glossary = Record<string, string>;
interface BrandLinks {
  apiExample?: string;
  docs?: string;
}

let extensionName = BASE_EXTENSION_NAME;
let productName = BASE_PRODUCT_NAME;
let glossary: Glossary = {};
let links: BrandLinks = {};

export const initializeBranding = (context: vscode.ExtensionContext): void => {
  const packageJson = context.extension.packageJSON as {
    name?: string;
    displayName?: string;
    brandGlossary?: Glossary;
    brandLinks?: BrandLinks;
  };

  if (packageJson.name) {
    extensionName = packageJson.name;
  }

  if (packageJson.displayName) {
    productName = packageJson.displayName;
  }

  glossary = packageJson.brandGlossary ?? {};
  links = packageJson.brandLinks ?? {};
};

export const getExtensionId = (): string => extensionIdFor(extensionName);

export const getConfigurationSection = (): string => extensionName;

export const getConfigurationKey = (settingKey: string): string =>
  configurationKeyFor(extensionName, settingKey);

export const getProductName = (): string => productName;

export const getPlatformName = (): string => platformNameOf(productName);

export const getMcpServerName = (): string => slugOf(extensionName);

export const getCommandId = (commandSuffix: string): string =>
  commandIdFor(getMcpServerName(), commandSuffix);

export const getDiagnosticCollectionName = (suffix: string): string =>
  identifierFor(getMcpServerName(), suffix);

export const getToolName = (baseToolName: string): string =>
  toolNameFor(getMcpServerName(), baseToolName);

export const getMcpProviderId = (): string => providerIdFor(getMcpServerName());

export const getTerm = (word: string): string => {
  const lower = word.toLowerCase();
  const direct = glossary[lower];

  if (direct) {
    return direct;
  }

  if (lower.endsWith("s")) {
    const singular = glossary[lower.slice(0, -1)];

    if (singular) {
      return `${singular}s`;
    }
  }

  return word;
};

export const getTerminologyBridge = (): string => {
  const entries = Object.entries(glossary);

  if (entries.length === 0) {
    return "";
  }

  return [
    `## ${getProductName()} Terminology`,
    "",
    "The tools and APIs you call use the platform's underlying terms, so reason in those.",
    "Use the names below when speaking to the user, and understand them when the user uses them:",
    "",
    ...entries.map(
      ([term, presented]) => `- **${term}** is presented as **${presented}**`
    ),
    ""
  ].join("\n");
};

export const getApiUrlPlaceholder = (): string =>
  links.apiExample
    ? `e.g., ${links.apiExample}`
    : `Your ${getPlatformName()} API URL`;

export const getDocsReference = (): string =>
  links.docs ?? `your ${getPlatformName()} documentation`;
