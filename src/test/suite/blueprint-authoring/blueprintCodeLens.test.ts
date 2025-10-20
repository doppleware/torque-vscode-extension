/**
 * Blueprint CodeLens Provider Test Suite
 *
 * Tests the CodeLens functionality for blueprint YAML files
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { BlueprintCodeLensProvider } from "../../../domains/blueprint-authoring";
import { SettingsManager } from "../../../domains/setup";
import { BLUEPRINT_TEMPLATE } from "../../../domains/blueprint-authoring";

suite("Blueprint CodeLens Provider Test Suite", () => {
  let testContext: vscode.ExtensionContext;
  let settingsManager: SettingsManager;
  let codeLensProvider: BlueprintCodeLensProvider;

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
    codeLensProvider = new BlueprintCodeLensProvider(settingsManager);
  });

  suiteTeardown(async () => {
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

  suite("Blueprint File Detection", () => {
    test("SHOULD provide CodeLens for blueprint YAML files", async () => {
      // Create a mock document with blueprint content
      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: BLUEPRINT_TEMPLATE
      });

      // Get CodeLens items
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.ok(codeLenses, "Should return CodeLens items");
      assert.strictEqual(
        codeLenses.length,
        1,
        "Should return exactly one CodeLens"
      );
      assert.ok(
        codeLenses[0].command?.title.includes("Active Space:"),
        "CodeLens title should mention Active Space"
      );
    });

    test("SHOULD NOT provide CodeLens for non-YAML files", async () => {
      // Create a mock document with non-YAML content
      const doc = await vscode.workspace.openTextDocument({
        language: "javascript",
        content: "console.log('test');"
      });

      // Get CodeLens items
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(
        codeLenses.length,
        0,
        "Should not return CodeLens for non-YAML files"
      );
    });

    test("SHOULD NOT provide CodeLens for non-blueprint YAML files", async () => {
      // Create a mock document with regular YAML content (no blueprint schema)
      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test"
      });

      // Get CodeLens items
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(
        codeLenses.length,
        0,
        "Should not return CodeLens for non-blueprint YAML files"
      );
    });

    test("SHOULD detect blueprint files with spec_version: 2", async () => {
      // Create a mock document with spec_version but no schema comment
      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: "spec_version: 2\ndescription: 'test'\ninputs:\ngrains:"
      });

      // Get CodeLens items
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.ok(codeLenses, "Should return CodeLens items");
      assert.strictEqual(
        codeLenses.length,
        1,
        "Should return CodeLens for files with spec_version: 2"
      );
    });
  });

  suite("Active Space Display", () => {
    test("SHOULD show active space when set", async () => {
      // Arrange - Set active space
      const activeSpace = "my-active-space";
      await settingsManager.setSetting(
        "activeSpace",
        activeSpace,
        vscode.ConfigurationTarget.Workspace
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: BLUEPRINT_TEMPLATE
      });

      // Act
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(codeLenses.length, 1, "Should return one CodeLens");
      assert.ok(
        codeLenses[0].command?.title.includes(activeSpace),
        `CodeLens should display active space: ${activeSpace}`
      );
    });

    test("SHOULD show default space with '(Default)' indicator when active space is not set", async () => {
      // Arrange - Set only default space
      const defaultSpace = "my-default-space";
      await settingsManager.setSetting(
        "space",
        defaultSpace,
        vscode.ConfigurationTarget.Global
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: BLUEPRINT_TEMPLATE
      });

      // Act
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(codeLenses.length, 1, "Should return one CodeLens");
      assert.ok(
        codeLenses[0].command?.title.includes(defaultSpace),
        `CodeLens should display default space: ${defaultSpace}`
      );
      assert.ok(
        codeLenses[0].command?.title.includes("(Default)"),
        "CodeLens should indicate it's using the default space"
      );
    });

    test("SHOULD show 'Not Set' when no space is configured", async () => {
      // Arrange - Explicitly clear both spaces to ensure nothing is configured
      await settingsManager.setSetting(
        "activeSpace",
        undefined,
        vscode.ConfigurationTarget.Workspace
      );
      await settingsManager.setSetting(
        "space",
        undefined,
        vscode.ConfigurationTarget.Global
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: BLUEPRINT_TEMPLATE
      });

      // Act
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(codeLenses.length, 1, "Should return one CodeLens");
      assert.ok(
        codeLenses[0].command?.title.includes("Not Set"),
        "CodeLens should display 'Not Set' when no space is configured"
      );
      assert.ok(
        !codeLenses[0].command?.title.includes("(Default)"),
        "CodeLens should not show '(Default)' when no space is configured"
      );
    });

    test("SHOULD prefer active space over default space", async () => {
      // Arrange - Set both active and default spaces
      const activeSpace = "my-active-space";
      const defaultSpace = "my-default-space";

      await settingsManager.setSetting(
        "space",
        defaultSpace,
        vscode.ConfigurationTarget.Global
      );
      await settingsManager.setSetting(
        "activeSpace",
        activeSpace,
        vscode.ConfigurationTarget.Workspace
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: BLUEPRINT_TEMPLATE
      });

      // Act
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(codeLenses.length, 1, "Should return one CodeLens");
      assert.ok(
        codeLenses[0].command?.title.includes(activeSpace),
        `CodeLens should prefer active space: ${activeSpace} over default`
      );
      assert.ok(
        !codeLenses[0].command?.title.includes(defaultSpace),
        "CodeLens should not show default space when active space is set"
      );
      assert.ok(
        !codeLenses[0].command?.title.includes("(Default)"),
        "CodeLens should not show '(Default)' indicator when active space overrides default"
      );
    });
  });

  suite("CodeLens Interaction", () => {
    test("SHOULD have command to set active space", async () => {
      // Arrange
      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: BLUEPRINT_TEMPLATE
      });

      // Act
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(codeLenses.length, 1, "Should return one CodeLens");
      assert.strictEqual(
        codeLenses[0].command?.command,
        "torque.setActiveSpace",
        "CodeLens should have command to set active space"
      );
      assert.ok(
        codeLenses[0].command?.tooltip,
        "CodeLens should have a tooltip"
      );
    });

    test("SHOULD place CodeLens at top of document", async () => {
      // Arrange
      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: BLUEPRINT_TEMPLATE
      });

      // Act
      const codeLenses = await codeLensProvider.provideCodeLenses(doc);

      // Assert
      assert.strictEqual(codeLenses.length, 1, "Should return one CodeLens");
      assert.strictEqual(
        codeLenses[0].range.start.line,
        0,
        "CodeLens should be at line 0"
      );
      assert.strictEqual(
        codeLenses[0].range.start.character,
        0,
        "CodeLens should be at character 0"
      );
    });
  });
});
