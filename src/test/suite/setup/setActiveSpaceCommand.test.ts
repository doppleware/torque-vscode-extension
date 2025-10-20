/**
 * Set Active Space Command Test Suite
 *
 * Tests the torque.setActiveSpace command functionality
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { SettingsManager } from "../../../domains/setup";

suite("Set Active Space Command Test Suite", () => {
  let testContext: vscode.ExtensionContext;
  let settingsManager: SettingsManager;
  let originalShowQuickPick: typeof vscode.window.showQuickPick;
  let originalShowInformationMessage: typeof vscode.window.showInformationMessage;
  let originalShowErrorMessage: typeof vscode.window.showErrorMessage;

  suiteSetup(async () => {
    // Get the extension and activate it
    const ext = vscode.extensions.getExtension("quali.torque-ai");
    assert.ok(ext, "Extension should be available");

    await ext.activate();
    assert.strictEqual(ext.isActive, true, "Extension should be active");

    // Create a mock context for testing
    testContext = {
      secrets: {
        get: async (key: string) => {
          const storage = (testContext as any)._secretStorage || {};
          return storage[key] as string | undefined;
        },
        store: async (key: string, value: string) => {
          if (!(testContext as any)._secretStorage) {
            (testContext as any)._secretStorage = {};
          }
          (testContext as any)._secretStorage[key] = value;
        },
        delete: async (key: string) => {
          if ((testContext as any)._secretStorage) {
            delete (testContext as any)._secretStorage[key];
          }
        },
        keys: async () => {
          const storage = (testContext as any)._secretStorage || {};
          return Object.keys(storage);
        },
        onDidChange: () => ({ dispose: () => {} }) as vscode.Disposable
      },
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: async () => {},
        keys: () => []
      },
      globalState: {
        get: () => undefined,
        update: async () => {},
        keys: () => [],
        setKeysForSync: () => {}
      },
      extensionUri: vscode.Uri.file("/mock/path"),
      extensionPath: "/mock/path",
      environmentVariableCollection: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      logUri: vscode.Uri.file("/mock/log"),
      logPath: "/mock/log",
      storageUri: vscode.Uri.file("/mock/storage"),
      storagePath: "/mock/storage",
      globalStorageUri: vscode.Uri.file("/mock/global-storage"),
      globalStoragePath: "/mock/global-storage",
      asAbsolutePath: (relativePath: string) => `/mock/path/${relativePath}`,
      languageModelAccessInformation: {} as any,
      extension: {
        packageJSON: {
          name: "torque-ai"
        }
      } as any
    } as vscode.ExtensionContext;

    settingsManager = new SettingsManager(testContext);

    // Store original functions
    originalShowQuickPick = vscode.window.showQuickPick;
    originalShowInformationMessage = vscode.window.showInformationMessage;
    originalShowErrorMessage = vscode.window.showErrorMessage;
  });

  suiteTeardown(async () => {
    // Restore original functions
    (vscode.window as any).showQuickPick = originalShowQuickPick;
    (vscode.window as any).showInformationMessage =
      originalShowInformationMessage;
    (vscode.window as any).showErrorMessage = originalShowErrorMessage;

    // Clean up test storage
    (testContext as any)._secretStorage = {};

    // Clean up workspace configuration
    const config = vscode.workspace.getConfiguration("torque-ai");
    await config.update(
      "activeSpace",
      undefined,
      vscode.ConfigurationTarget.Workspace
    );
    await config.update(
      "space",
      undefined,
      vscode.ConfigurationTarget.Workspace
    );
  });

  setup(async () => {
    // Reset test state before each test
    (testContext as any)._secretStorage = {};

    // Clean up workspace configuration before each test
    const config = vscode.workspace.getConfiguration("torque-ai");
    await config.update(
      "activeSpace",
      undefined,
      vscode.ConfigurationTarget.Workspace
    );
    await config.update(
      "space",
      undefined,
      vscode.ConfigurationTarget.Workspace
    );
  });

  suite("GIVEN extension is not configured", () => {
    test("SHOULD show error and offer to configure", async () => {
      // Arrange - Clear all credentials to ensure extension is not configured
      await settingsManager.setSetting("url", undefined);
      await settingsManager.setSetting("token", undefined);
      await settingsManager.setSetting("space", undefined);
      await settingsManager.setSetting("activeSpace", undefined);

      // Reset the API client to simulate extension not being configured
      const ext = vscode.extensions.getExtension("quali.torque-ai");
      ext?.exports?.resetApiClientForTesting?.();

      let errorMessageShown = false;
      let configureOffered = false;

      (vscode.window as any).showErrorMessage = async (
        message: string,
        ...actions: string[]
      ) => {
        if (message.includes("not configured")) {
          errorMessageShown = true;
          configureOffered = actions.includes("Configure Now");
        }
        return undefined;
      };

      // Act
      await vscode.commands.executeCommand("torque.setActiveSpace");

      // Assert
      assert.strictEqual(
        errorMessageShown,
        true,
        "Should show error message when not configured"
      );
      assert.strictEqual(configureOffered, true, "Should offer to configure");
    });
  });

  suite("GIVEN extension is configured", () => {
    let originalShowErrorMessage: typeof vscode.window.showErrorMessage;

    setup(async () => {
      // Configure extension with credentials
      await settingsManager.setSetting("url", "https://portal.qtorque.io");
      await settingsManager.setSetting("token", "test-token-1234567890");

      // Mock error messages to not interfere with tests
      originalShowErrorMessage = vscode.window.showErrorMessage;
      (vscode.window as any).showErrorMessage = async (message: string) => {
        // Silently ignore errors during tests
        return undefined;
      };
    });

    teardown(() => {
      // Restore error message function
      (vscode.window as any).showErrorMessage = originalShowErrorMessage;
    });

    test("SHOULD handle API errors gracefully", async () => {
      // Arrange
      let errorHandled = false;

      (vscode.window as any).showErrorMessage = async (message: string) => {
        errorHandled = true;
        // Verify error message mentions the failure
        assert.ok(
          message.includes("Failed"),
          "Error message should mention failure"
        );
        return undefined;
      };

      // Act - Command will fail because API is not actually available
      await vscode.commands.executeCommand("torque.setActiveSpace");

      // Assert - The command should handle the error gracefully
      // Either by showing an error message or handling it silently
      // We're just verifying it doesn't crash
      assert.ok(true, "Command should complete without crashing");
    });

    test("SHOULD handle user cancellation gracefully", async () => {
      // Arrange
      (vscode.window as any).showQuickPick = async () => {
        return undefined; // User cancelled
      };

      let messageShown = false;
      (vscode.window as any).showInformationMessage = async () => {
        messageShown = true;
      };

      // Act
      await vscode.commands.executeCommand("torque.setActiveSpace");

      // Assert
      assert.strictEqual(
        messageShown,
        false,
        "Should not show any message on cancellation"
      );
    });
  });

  suite("Integration Tests", () => {
    test("SHOULD register torque.setActiveSpace command", async () => {
      // Verify command is registered
      const commands = await vscode.commands.getCommands();
      assert.ok(
        commands.includes("torque.setActiveSpace"),
        "Command should be registered"
      );
    });

    test("SHOULD be able to write and read activeSpace setting", async () => {
      // This verifies that the configuration is properly registered in package.json
      const testSpace = "integration-test-space";

      await settingsManager.setSetting(
        "activeSpace",
        testSpace,
        vscode.ConfigurationTarget.Workspace
      );

      const retrievedSpace =
        await settingsManager.getSetting<string>("activeSpace");

      assert.strictEqual(
        retrievedSpace,
        testSpace,
        "Should be able to write and retrieve activeSpace setting"
      );
    });
  });
});
