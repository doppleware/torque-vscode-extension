/**
 * Branding Test Suite
 *
 * Tests that configuration keys stay in sync with the extension manifest
 */

import * as assert from "assert";
import vscode from "vscode";
import { getConfigurationKey, getConfigurationSection } from "../../branding";

suite("Branding Test Suite", () => {
  test("Should derive the configuration section from the extension manifest", () => {
    const extension = vscode.extensions.getExtension("quali.torque-ai");
    const manifestName = (
      extension?.packageJSON as { name?: string } | undefined
    )?.name;

    assert.ok(manifestName, "extension manifest should expose a name");
    assert.strictEqual(getConfigurationSection(), manifestName);
  });

  test("Should build configuration keys from the derived section", () => {
    assert.strictEqual(
      getConfigurationKey("activeSpace"),
      `${getConfigurationSection()}.activeSpace`
    );
  });
});
