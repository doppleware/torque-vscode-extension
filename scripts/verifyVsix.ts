import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

import {
  PUBLISHER,
  commandIdFor,
  platformNameOf,
  providerIdFor,
  slugOf,
  suffixOf,
  toolNameFor,
  uriActivationEventFor
} from "../src/brandNaming";
import { findBrandLeaks, findTermLeaks, type Glossary } from "./brandText";

const DIST = "dist";
const README_ENTRY = "extension/readme.md";
const TEMPLATE_ENTRY = "extension/docs/torque_dev_instruction.md";

interface Contributes {
  configuration?: { properties?: Record<string, unknown> };
  commands?: { command?: string }[];
  menus?: Record<string, { command?: string }[]>;
  fileTemplates?: { id?: string }[];
  mcpServerDefinitionProviders?: { id?: string }[];
  languageModelTools?: { name?: string; toolReferenceName?: string }[];
}

interface Manifest {
  name: string;
  displayName: string;
  publisher: string;
  icon?: string;
  activationEvents?: string[];
  contributes?: Contributes;
}

type Ids = (string | undefined)[];

const readEntry = (vsix: string, entry: string): string =>
  execFileSync("unzip", ["-p", vsix, entry], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });

const listEntries = (vsix: string): string[] =>
  execFileSync("unzip", ["-Z1", vsix], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const commandIds = (contributes?: Contributes): Ids =>
  (contributes?.commands ?? []).map((command) => command.command);

const menuCommandIds = (contributes?: Contributes): Ids =>
  Object.values(contributes?.menus ?? {})
    .flat()
    .map((entry) => entry.command);

const fileTemplateIds = (contributes?: Contributes): Ids =>
  (contributes?.fileTemplates ?? []).map((template) => template.id);

const providerIds = (contributes?: Contributes): Ids =>
  (contributes?.mcpServerDefinitionProviders ?? []).map(
    (provider) => provider.id
  );

const toolNames = (contributes?: Contributes): Ids =>
  (contributes?.languageModelTools ?? []).flatMap((tool) => [
    tool.name,
    tool.toolReferenceName
  ]);

const configurationKeys = (contributes?: Contributes): string[] =>
  Object.keys(contributes?.configuration?.properties ?? {});

const rename = (slug: string, id: string | undefined): string | undefined =>
  id && commandIdFor(slug, suffixOf(id));

const base = JSON.parse(fs.readFileSync("package.json", "utf8")) as Manifest;
const baseSlug = slugOf(base.name);

const verifyBrand = (brandId: string): string[] => {
  const brandPath = path.join("branding", brandId, "brand.json");
  if (!fs.existsSync(brandPath)) {
    return [`branding/${brandId} has no brand.json`];
  }

  const brand = JSON.parse(fs.readFileSync(brandPath, "utf8")) as {
    manifest?: { name?: string; displayName?: string; icon?: string };
    glossary?: Glossary;
    phrases?: Glossary;
  };
  const name = brand.manifest?.name;
  const displayName = brand.manifest?.displayName;

  if (!name || !displayName) {
    return [`branding/${brandId}/brand.json is missing name or displayName`];
  }

  const vsix = path.join(DIST, `${name}.vsix`);
  if (!fs.existsSync(vsix)) {
    return [`${vsix} was not produced`];
  }

  const failures: string[] = [];
  const label = path.basename(vsix);
  const packaged = JSON.parse(
    readEntry(vsix, "extension/package.json")
  ) as Manifest;
  const entries = listEntries(vsix);
  const slug = slugOf(name);

  const expect = (field: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(
        `${field}: expected ${JSON.stringify(expected)}, package has ${JSON.stringify(actual)}`
      );
    }
  };

  if (commandIds(packaged.contributes).length === 0) {
    failures.push("package declares no commands - contributions are missing");
  }

  if (toolNames(packaged.contributes).length === 0) {
    failures.push("package declares no language model tools");
  }

  expect("name", packaged.name, name);
  expect("displayName", packaged.displayName, displayName);
  expect("publisher", packaged.publisher, PUBLISHER);
  expect("icon", packaged.icon, brand.manifest?.icon);

  if (
    !(packaged.activationEvents ?? []).includes(uriActivationEventFor(name))
  ) {
    failures.push(
      `activationEvents is missing "${uriActivationEventFor(name)}"`
    );
  }

  expect(
    "configuration keys",
    configurationKeys(packaged.contributes),
    configurationKeys(base.contributes).map(
      (key) => `${name}.${key.slice(base.name.length + 1)}`
    )
  );
  expect(
    "command ids",
    commandIds(packaged.contributes),
    commandIds(base.contributes).map((id) => rename(slug, id))
  );
  expect(
    "menu command ids",
    menuCommandIds(packaged.contributes),
    menuCommandIds(base.contributes).map((id) => rename(slug, id))
  );
  expect(
    "file template ids",
    fileTemplateIds(packaged.contributes),
    fileTemplateIds(base.contributes).map((id) => rename(slug, id))
  );
  expect(
    "mcp provider ids",
    providerIds(packaged.contributes),
    providerIds(base.contributes).map(() => providerIdFor(slug))
  );
  expect(
    "tool names",
    toolNames(packaged.contributes),
    toolNames(base.contributes).map((toolName) =>
      toolName === undefined ? undefined : toolNameFor(slug, toolName)
    )
  );

  if (packaged.icon && !entries.includes(`extension/${packaged.icon}`)) {
    failures.push(`icon "${packaged.icon}" is not inside the package`);
  }

  for (const required of [
    "extension/out/extension.js",
    "extension/LICENSE.txt",
    README_ENTRY,
    TEMPLATE_ENTRY
  ]) {
    if (!entries.includes(required)) {
      failures.push(`missing ${required}`);
    }
  }

  const otherBrandAssets = entries.filter(
    (entry) =>
      entry.startsWith("extension/branding/") &&
      !entry.startsWith(`extension/branding/${brandId}/`)
  );
  if (otherBrandAssets.length > 0) {
    failures.push(
      `ships another brand's assets: ${otherBrandAssets.join(", ")}`
    );
  }

  if (displayName !== base.displayName) {
    const leakedTerms = [base.displayName, platformNameOf(base.displayName)];

    for (const leak of findBrandLeaks(packaged.contributes, leakedTerms)) {
      failures.push(`contributes leaks ${leak}`);
    }

    for (const leak of findBrandLeaks(
      readEntry(vsix, README_ENTRY),
      leakedTerms
    )) {
      failures.push(`readme leaks ${leak}`);
    }
  }

  const glossary = brand.glossary ?? {};
  const substitutionTerms = { ...glossary, ...(brand.phrases ?? {}) };

  if (Object.keys(glossary).length > 0) {
    const declared = (packaged as { brandGlossary?: Glossary }).brandGlossary;

    if (JSON.stringify(declared) !== JSON.stringify(glossary)) {
      failures.push("brandGlossary was not written into the manifest");
    }

    for (const leak of findTermLeaks(packaged.contributes, substitutionTerms)) {
      failures.push(`contributes still uses the platform term ${leak}`);
    }

    for (const leak of findTermLeaks(
      readEntry(vsix, README_ENTRY),
      substitutionTerms
    )) {
      failures.push(`readme still uses the platform term ${leak}`);
    }
  }

  return failures.map((failure) => `${label}: ${failure}`);
};

const brandIds = fs
  .readdirSync("branding", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (!brandIds.some((brandId) => brandId === baseSlug)) {
  process.stdout.write(
    `warning: no branding/ directory matches the base slug "${baseSlug}"\n`
  );
}

const failures = brandIds.flatMap(verifyBrand);

for (const brandId of brandIds) {
  process.stdout.write(`checked branding/${brandId}\n`);
}

if (failures.length > 0) {
  throw new Error(`VSIX verification failed:\n  - ${failures.join("\n  - ")}`);
}

process.stdout.write(`All ${brandIds.length} packages verified.\n`);
