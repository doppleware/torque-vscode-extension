/**
 * Branding Test Suite
 *
 * Tests that configuration keys stay in sync with the extension manifest
 */

import * as assert from "assert";
import vscode from "vscode";
import { BASE_EXTENSION_NAME, extensionIdFor } from "../../brandNaming";
import {
  getCommandId,
  getConfigurationKey,
  getConfigurationSection,
  getMcpProviderId,
  getMcpServerName,
  getPlatformName,
  getProductName,
  getTerm,
  getTerminologyBridge
} from "../../branding";

interface ExtensionManifest {
  name?: string;
  displayName?: string;
  brandGlossary?: Record<string, string>;
  contributes?: {
    configuration?: { properties?: Record<string, unknown> };
    commands?: { command: string }[];
    mcpServerDefinitionProviders?: { id: string }[];
  };
}

const getManifest = (): ExtensionManifest => {
  const extension = vscode.extensions.getExtension(
    extensionIdFor(BASE_EXTENSION_NAME)
  );
  assert.ok(extension, "extension should be resolvable by id");
  return extension.packageJSON as ExtensionManifest;
};

suite("Branding Test Suite", () => {
  test("Should derive the configuration section from the extension manifest", () => {
    const manifestName = getManifest().name;

    assert.ok(manifestName, "extension manifest should expose a name");
    assert.strictEqual(getConfigurationSection(), manifestName);
  });

  test("Should build configuration keys from the derived section", () => {
    assert.strictEqual(
      getConfigurationKey("activeSpace"),
      `${getConfigurationSection()}.activeSpace`
    );
  });

  test("Should derive the product name from the manifest display name", () => {
    const displayName = getManifest().displayName;

    assert.ok(displayName, "extension manifest should expose a displayName");
    assert.strictEqual(getProductName(), displayName);
  });

  test("Should derive the platform name by dropping the AI suffix", () => {
    assert.strictEqual(getPlatformName(), getProductName().replace(/ AI$/, ""));
    assert.ok(!getPlatformName().endsWith(" AI"));
  });

  test("Should derive the MCP server name by dropping the ai suffix", () => {
    assert.strictEqual(
      getMcpServerName(),
      getConfigurationSection().replace(/-ai$/, "")
    );
    assert.ok(!getMcpServerName().endsWith("-ai"));
  });

  test("Should derive command ids that match the manifest contributions", () => {
    const declared = getManifest().contributes?.commands ?? [];

    assert.ok(declared.length > 0, "extension should contribute commands");

    for (const { command } of declared) {
      const separator = command.indexOf(".");
      assert.ok(separator > 0, `command "${command}" should be namespaced`);
      assert.strictEqual(getCommandId(command.slice(separator + 1)), command);
    }
  });

  test("Should derive the MCP provider id declared in the manifest", () => {
    const declared = getManifest().contributes?.mcpServerDefinitionProviders;

    assert.ok(declared?.length, "extension should contribute an MCP provider");
    assert.strictEqual(getMcpProviderId(), declared[0].id);
  });

  test("Should map terms through the manifest glossary", () => {
    const glossary = getManifest().brandGlossary ?? {};
    const [term, presented] = Object.entries(glossary)[0] ?? [];

    if (!term || !presented) {
      assert.strictEqual(
        getTerm("environment"),
        "environment",
        "without a glossary getTerm must be an identity"
      );
      return;
    }

    assert.strictEqual(getTerm(term), presented);
    assert.strictEqual(getTerm(`${term}s`), `${presented}s`);
  });

  test("Should leave unmapped words untouched", () => {
    assert.strictEqual(getTerm("blueprint"), "blueprint");
    assert.strictEqual(getTerm("Blueprint"), "Blueprint");
  });

  test("Should describe the glossary only when the brand has one", () => {
    const glossary = getManifest().brandGlossary ?? {};
    const bridge = getTerminologyBridge();

    if (Object.keys(glossary).length === 0) {
      assert.strictEqual(bridge, "");
      return;
    }

    for (const [term, presented] of Object.entries(glossary)) {
      assert.ok(bridge.includes(term), `bridge should mention "${term}"`);
      assert.ok(
        bridge.includes(presented),
        `bridge should mention "${presented}"`
      );
    }
  });

  test("Should namespace every contributed setting under the extension name", () => {
    const manifest = getManifest();
    const properties = manifest.contributes?.configuration?.properties ?? {};

    assert.ok(
      Object.keys(properties).length > 0,
      "extension should contribute configuration"
    );

    for (const key of Object.keys(properties)) {
      assert.ok(
        key.startsWith(`${manifest.name}.`),
        `configuration key "${key}" must be namespaced under "${manifest.name}." so brand packaging can rekey it`
      );
    }
  });
});
