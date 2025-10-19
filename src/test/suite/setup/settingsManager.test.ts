import * as assert from "assert";
import * as vscode from "vscode";
import { SettingsManager } from "../../../domains/setup";

suite("SettingsManager Test Suite", () => {
  let context: vscode.ExtensionContext;
  let settingsManager: SettingsManager;

  setup(async () => {
    const ext = vscode.extensions.getExtension("quali.torque-ai");
    assert.ok(ext);
    await ext.activate();

    // Create a mock extension context for testing
    context = {
      extension: ext,
      extensionPath: ext.extensionPath,
      extensionUri: ext.extensionUri,
      asAbsolutePath: (relativePath: string) =>
        ext.extensionPath + "/" + relativePath,
      storagePath: "/tmp/storage",
      globalStoragePath: "/tmp/globalStorage",
      logPath: "/tmp/logs",
      globalState: {
        get: () => undefined,

        update: async () => {},
        keys: () => [],

        setKeysForSync: () => {}
      },
      workspaceState: {
        get: () => undefined,

        update: async () => {},
        keys: () => [],

        setKeysForSync: () => {}
      },
      secrets: {
        get: async () => undefined,

        store: async () => {},

        delete: async () => {}
      },
      subscriptions: [],
      globalStorageUri: vscode.Uri.file("/tmp"),
      logUri: vscode.Uri.file("/tmp"),
      storageUri: vscode.Uri.file("/tmp"),

      environmentVariableCollection: {} as any,
      extensionMode: vscode.ExtensionMode.Test,

      languageModelAccessInformation: {} as any
    } as unknown as vscode.ExtensionContext;

    settingsManager = new SettingsManager(context);
  });

  test("Should initialize SettingsManager", () => {
    assert.ok(settingsManager);
  });

  test("Should handle unknown setting gracefully", async () => {
    try {
      await settingsManager.getSetting("unknownSetting");
      assert.fail("Should have thrown an error");
    } catch (error: unknown) {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.message, "Unknown setting: unknownSetting");
    }
  });

  test("Should get default URL setting", async () => {
    const url = await settingsManager.getSetting<string>("url");
    // Should return the default value or undefined if not configured
    assert.ok(url === undefined || typeof url === "string");
  });

  test("Should detect configuration scope changes", () => {
    // Test detectChangedScope with empty array (should not throw)
    const scope = settingsManager.detectChangedScope([]);
    assert.ok(scope === undefined || typeof scope === "number");
  });

  test("Should successfully write and retrieve non-secret settings from workspace configuration", async () => {
    // This test replicates the error: "Unable to write to Workspace Settings because torque-ai.space is not a registered configuration"
    // Non-secret settings like "space" must be registered in package.json under contributes.configuration
    // This test will FAIL if the configuration is not properly registered

    const testSpaceName = "test-space-name";

    // Write the space setting to workspace configuration
    await settingsManager.setSetting("space", testSpaceName);

    // Read it back - this ensures the setting was actually persisted to VS Code configuration
    const retrievedSpace = await settingsManager.getSetting<string>("space");

    // Assert that we can retrieve the exact value we stored
    assert.strictEqual(
      retrievedSpace,
      testSpaceName,
      "Should be able to write and retrieve the space setting from workspace configuration"
    );
  });
});
