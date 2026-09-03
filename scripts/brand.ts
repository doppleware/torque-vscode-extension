import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

import {
  BASE_EXTENSION_NAME,
  PUBLISHER,
  extensionIdFor,
  platformNameOf,
  slugOf,
  toCamelCase,
  toolNameFor
} from "../src/brandNaming";
import {
  applyEverywhere,
  applyGlossary,
  applyReplacements,
  findBrandLeaks,
  findTermLeaks,
  substitute,
  substituteEverywhere,
  substituteTerms,
  type Glossary,
  type Replacement
} from "./brandText";

const TEXT_ASSETS = ["README.md"];

interface Contributes {
  configuration?: { properties?: Record<string, unknown> };
  commands?: { command?: string }[];
  menus?: Record<string, { command?: string }[]>;
  fileTemplates?: { id?: string }[];
  mcpServerDefinitionProviders?: { id?: string }[];
  languageModelTools?: {
    name?: string;
    toolReferenceName?: string;
    tags?: string[];
  }[];
}

interface VsixManifest {
  name: string;
  displayName: string;
  publisher: string;
  version: string;
  description?: string;
  icon?: string;
  activationEvents?: string[];
  contributes?: Contributes;
  [field: string]: unknown;
}

interface BrandDefinition {
  manifest: Partial<VsixManifest>;
  glossary?: Glossary;
  phrases?: Glossary;
  links?: Record<string, string>;
}

const parseArg = (flag: string): string | undefined =>
  process.argv.find((arg) => arg.startsWith(`${flag}=`))?.split("=")[1];

const rekeyConfiguration = (
  manifest: VsixManifest,
  fromName: string,
  toName: string
): void => {
  const configuration = manifest.contributes?.configuration;
  if (!configuration?.properties) {
    return;
  }

  configuration.properties = Object.fromEntries(
    Object.entries(configuration.properties).map(([key, value]) => [
      key.startsWith(`${fromName}.`)
        ? `${toName}.${key.slice(fromName.length + 1)}`
        : key,
      value
    ])
  );
};

const rekeyIdentifiers = (
  manifest: VsixManifest,
  fromName: string,
  toName: string
): void => {
  const contributes = manifest.contributes;
  if (!contributes) {
    return;
  }

  const fromSlug = slugOf(fromName);
  const toSlug = slugOf(toName);

  const renamePrefixed = (value: string | undefined): string | undefined =>
    value?.startsWith(`${fromSlug}.`)
      ? `${toSlug}.${value.slice(fromSlug.length + 1)}`
      : value;

  for (const command of contributes.commands ?? []) {
    command.command = renamePrefixed(command.command);
  }

  for (const entries of Object.values(contributes.menus ?? {})) {
    for (const entry of entries) {
      entry.command = renamePrefixed(entry.command);
    }
  }

  for (const template of contributes.fileTemplates ?? []) {
    template.id = renamePrefixed(template.id);
  }

  for (const provider of contributes.mcpServerDefinitionProviders ?? []) {
    provider.id = provider.id
      ?.split(toCamelCase(fromSlug))
      .join(toCamelCase(toSlug));
  }

  for (const tool of contributes.languageModelTools ?? []) {
    tool.tags = tool.tags?.map((tag) => (tag === fromSlug ? toSlug : tag));
    tool.name = tool.name && toolNameFor(toSlug, tool.name);
    tool.toolReferenceName =
      tool.toolReferenceName && toolNameFor(toSlug, tool.toolReferenceName);
  }
};

const assertBranded = (
  manifest: VsixManifest,
  leakedTerms: string[],
  terms: Glossary
): void => {
  const failures: string[] = [];

  if (manifest.publisher !== PUBLISHER) {
    failures.push(`publisher changed to "${manifest.publisher}"`);
  }

  for (const field of ["name", "displayName", "icon", "version"] as const) {
    if (!manifest[field]) {
      failures.push(`${field} is missing`);
    }
  }

  if (manifest.icon && !fs.existsSync(path.resolve(manifest.icon))) {
    failures.push(`icon "${manifest.icon}" does not exist`);
  }

  for (const key of Object.keys(
    manifest.contributes?.configuration?.properties ?? {}
  )) {
    if (!key.startsWith(`${manifest.name}.`)) {
      failures.push(`configuration key "${key}" was not rekeyed`);
    }
  }

  for (const leak of findBrandLeaks(manifest.contributes, leakedTerms)) {
    failures.push(`contributes still mentions ${leak}`);
  }

  for (const leak of findTermLeaks(manifest.contributes, terms)) {
    failures.push(`contributes still uses the platform term ${leak}`);
  }

  if (failures.length > 0) {
    throw new Error(`Brand transform failed:\n  - ${failures.join("\n  - ")}`);
  }
};

const resolveVsce = (): string => {
  const local = path.resolve(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "vsce.cmd" : "vsce"
  );
  return fs.existsSync(local) ? local : "vsce";
};

const brandIgnoreFileFor = (brandId: string, filePath: string): void => {
  const lines = fs
    .readFileSync(".vscodeignore", "utf8")
    .trimEnd()
    .split("\n")
    .filter((line) => !line.startsWith("!branding/"));

  fs.writeFileSync(
    filePath,
    [...lines, `!branding/${brandId}/logo.png`].join("\n") + "\n"
  );
};

const brandId = parseArg("--brand");
const outPath = parseArg("--out");

if (!brandId || !outPath) {
  throw new Error("Usage: brand.ts --brand=<id> --out=<path/to/file.vsix>");
}

const manifestPath = path.resolve("package.json");
const manifest = JSON.parse(
  fs.readFileSync(manifestPath, "utf8")
) as VsixManifest;

if (manifest.name !== BASE_EXTENSION_NAME) {
  throw new Error(
    `package.json name is "${manifest.name}", expected "${BASE_EXTENSION_NAME}". ` +
      "A brand overlay may still be applied - restore package.json first."
  );
}

const brandPath = path.resolve("branding", brandId, "brand.json");
if (!fs.existsSync(brandPath)) {
  throw new Error(`Missing brand definition: ${brandPath}`);
}

const brand = JSON.parse(fs.readFileSync(brandPath, "utf8")) as BrandDefinition;
const toName = brand.manifest.name;
const toDisplayName = brand.manifest.displayName;

if (!toName || !toDisplayName) {
  throw new Error(
    `branding/${brandId}/brand.json needs manifest.name and manifest.displayName`
  );
}

const identifierReplacements: Replacement[] = [
  [extensionIdFor(BASE_EXTENSION_NAME), extensionIdFor(toName)],
  [`${BASE_EXTENSION_NAME}.`, `${toName}.`]
];

const brandReplacements: Replacement[] = [
  [manifest.displayName, toDisplayName],
  [platformNameOf(manifest.displayName), platformNameOf(toDisplayName)]
];

const glossary = brand.glossary ?? {};
const substitutionTerms = { ...glossary, ...(brand.phrases ?? {}) };

const branded: VsixManifest = {
  ...manifest,
  description: applyReplacements(
    applyEverywhere(manifest.description, identifierReplacements),
    brandReplacements
  ) as string,
  activationEvents: applyEverywhere(
    manifest.activationEvents,
    identifierReplacements
  ) as string[],
  contributes: applyReplacements(
    applyEverywhere(manifest.contributes, identifierReplacements),
    brandReplacements
  ) as Contributes
};

branded.description = substituteTerms(
  branded.description ?? "",
  substitutionTerms
);
branded.contributes = applyGlossary(
  branded.contributes,
  substitutionTerms
) as Contributes;

if (Object.keys(glossary).length > 0) {
  branded.brandGlossary = glossary;
}

if (brand.links && Object.keys(brand.links).length > 0) {
  branded.brandLinks = brand.links;
}

rekeyConfiguration(branded, BASE_EXTENSION_NAME, toName);
rekeyIdentifiers(branded, BASE_EXTENSION_NAME, toName);
Object.assign(branded, brand.manifest);
assertBranded(
  branded,
  toDisplayName === manifest.displayName
    ? []
    : [manifest.displayName, platformNameOf(manifest.displayName)],
  substitutionTerms
);

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });

const ignorePath = path.resolve(`.vscodeignore.${brandId}`);
const originals = new Map<string, Buffer>();

const stage = (filePath: string, contents: string): void => {
  const original = fs.readFileSync(filePath);
  if (original.toString("utf8") === contents) {
    return;
  }
  originals.set(filePath, original);
  fs.writeFileSync(filePath, contents);
};

try {
  stage(manifestPath, `${JSON.stringify(branded, null, 2)}\n`);

  for (const asset of TEXT_ASSETS) {
    stage(
      asset,
      substituteTerms(
        substitute(
          substituteEverywhere(
            fs.readFileSync(asset, "utf8"),
            identifierReplacements
          ),
          brandReplacements
        ),
        substitutionTerms
      )
    );
  }

  brandIgnoreFileFor(brandId, ignorePath);
  execFileSync(
    resolveVsce(),
    ["package", "--out", outPath, "--ignoreFile", ignorePath],
    { stdio: "inherit" }
  );
} finally {
  for (const [filePath, original] of originals) {
    fs.writeFileSync(filePath, original);
  }
  fs.rmSync(ignorePath, { force: true });
}
