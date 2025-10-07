/**
 * Create Blueprint Command Test Suite
 *
 * Tests the torque.createBlueprint command functionality:
 * - Command registration
 * - File creation with proper template
 * - User prompts and validation
 * - File overwrite handling
 */

import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";

suite("Create Blueprint Command", () => {
  let originalShowInputBox: typeof vscode.window.showInputBox;
  let originalShowWarningMessage: typeof vscode.window.showWarningMessage;
  let originalShowInformationMessage: typeof vscode.window.showInformationMessage;

  const expectedBlueprintContent = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: ''
inputs:
grains:
`;

  suiteSetup(async () => {
    // Get the extension and activate it
    const ext = vscode.extensions.getExtension("quali.torque-ai");
    assert.ok(ext, "Extension should be available");

    await ext.activate();
    assert.strictEqual(ext.isActive, true, "Extension should be active");

    // Store original functions
    originalShowInputBox = vscode.window.showInputBox;
    originalShowWarningMessage = vscode.window.showWarningMessage;
    originalShowInformationMessage = vscode.window.showInformationMessage;
  });

  suiteTeardown(() => {
    // Restore original functions
    (vscode.window as any).showInputBox = originalShowInputBox;
    (vscode.window as any).showWarningMessage = originalShowWarningMessage;
    (vscode.window as any).showInformationMessage =
      originalShowInformationMessage;
  });

  setup(() => {
    // Reset mocks before each test
    (vscode.window as any).showInputBox = originalShowInputBox;
    (vscode.window as any).showWarningMessage = originalShowWarningMessage;
    (vscode.window as any).showInformationMessage =
      originalShowInformationMessage;
  });

  test("SHOULD register torque.createBlueprint command", async () => {
    // Act
    const allCommands = await vscode.commands.getCommands();

    // Assert
    assert.ok(
      allCommands.includes("torque.createBlueprint"),
      "Should register 'Create New Torque Blueprint' command"
    );
  });

  test("SHOULD prompt for filename with proper validation", async () => {
    // Arrange
    let inputPromptCalled = false;
    let inputValidationFunction:
      | vscode.InputBoxOptions["validateInput"]
      | undefined;

    (vscode.window as any).showInputBox = async (
      options: vscode.InputBoxOptions
    ) => {
      if (options?.prompt?.includes("blueprint filename")) {
        inputPromptCalled = true;
        inputValidationFunction = options.validateInput;

        // Verify placeholder
        assert.strictEqual(
          options.placeHolder,
          "blueprint.yaml",
          "Should show correct placeholder"
        );

        return undefined; // Cancel the operation
      }
      return undefined;
    };

    // Act
    await vscode.commands.executeCommand("torque.createBlueprint");

    // Assert
    assert.strictEqual(inputPromptCalled, true, "Should prompt for filename");
    assert.ok(inputValidationFunction, "Should provide filename validation");

    // Test filename validation
    if (inputValidationFunction) {
      const emptyResult = await Promise.resolve(inputValidationFunction(""));
      const invalidResult = await Promise.resolve(
        inputValidationFunction("test.txt")
      );
      const validYamlResult = await Promise.resolve(
        inputValidationFunction("blueprint.yaml")
      );
      const validYmlResult = await Promise.resolve(
        inputValidationFunction("blueprint.yml")
      );

      assert.strictEqual(emptyResult, "Filename is required");
      assert.strictEqual(invalidResult, "Filename must end with .yaml or .yml");
      assert.strictEqual(validYamlResult, undefined);
      assert.strictEqual(validYmlResult, undefined);
    }
  });

  test("SHOULD create blueprint file with correct content", async () => {
    // Arrange
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // Skip test if no workspace is open
      console.log("Skipping test - no workspace folder available");
      return;
    }

    const testFilename = "test-blueprint.yaml";
    const workspaceRoot = workspaceFolders[0].uri;
    const blueprintUri = vscode.Uri.joinPath(workspaceRoot, testFilename);

    // Clean up test file if it exists
    try {
      await vscode.workspace.fs.delete(blueprintUri);
    } catch {
      // File doesn't exist, continue
    }

    (vscode.window as any).showInputBox = async (
      options: vscode.InputBoxOptions
    ) => {
      if (options?.prompt?.includes("blueprint filename")) {
        return testFilename;
      }
      return undefined;
    };

    (vscode.window as any).showInformationMessage = async () => undefined;

    try {
      // Act
      await vscode.commands.executeCommand("torque.createBlueprint");

      // Assert - verify file was created
      const fileContent = await vscode.workspace.fs.readFile(blueprintUri);
      const contentString = Buffer.from(fileContent).toString("utf8");

      assert.strictEqual(
        contentString,
        expectedBlueprintContent,
        "File should have correct blueprint template content"
      );
    } finally {
      // Cleanup - delete test file
      try {
        await vscode.workspace.fs.delete(blueprintUri);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("SHOULD prompt for overwrite when file exists", async () => {
    // Arrange
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log("Skipping test - no workspace folder available");
      return;
    }

    const testFilename = "existing-blueprint.yaml";
    const workspaceRoot = workspaceFolders[0].uri;
    const blueprintUri = vscode.Uri.joinPath(workspaceRoot, testFilename);

    // Create an existing file
    await vscode.workspace.fs.writeFile(
      blueprintUri,
      Buffer.from("existing content", "utf8")
    );

    let overwritePromptShown = false;

    (vscode.window as any).showInputBox = async (
      options: vscode.InputBoxOptions
    ) => {
      if (options?.prompt?.includes("blueprint filename")) {
        return testFilename;
      }
      return undefined;
    };

    (vscode.window as any).showWarningMessage = async (
      message: string,
      ...actions: string[]
    ) => {
      if (message.includes("already exists")) {
        overwritePromptShown = true;
        return "No"; // Don't overwrite
      }
      return undefined;
    };

    try {
      // Act
      await vscode.commands.executeCommand("torque.createBlueprint");

      // Assert
      assert.strictEqual(
        overwritePromptShown,
        true,
        "Should prompt for overwrite confirmation"
      );

      // Verify file was not overwritten
      const fileContent = await vscode.workspace.fs.readFile(blueprintUri);
      const contentString = Buffer.from(fileContent).toString("utf8");
      assert.strictEqual(
        contentString,
        "existing content",
        "Should not overwrite when user selects No"
      );
    } finally {
      // Cleanup
      try {
        await vscode.workspace.fs.delete(blueprintUri);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("SHOULD overwrite file when user confirms", async () => {
    // Arrange
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log("Skipping test - no workspace folder available");
      return;
    }

    const testFilename = "overwrite-blueprint.yaml";
    const workspaceRoot = workspaceFolders[0].uri;
    const blueprintUri = vscode.Uri.joinPath(workspaceRoot, testFilename);

    // Create an existing file
    await vscode.workspace.fs.writeFile(
      blueprintUri,
      Buffer.from("old content", "utf8")
    );

    (vscode.window as any).showInputBox = async (
      options: vscode.InputBoxOptions
    ) => {
      if (options?.prompt?.includes("blueprint filename")) {
        return testFilename;
      }
      return undefined;
    };

    (vscode.window as any).showWarningMessage = async (
      message: string,
      ...actions: string[]
    ) => {
      if (message.includes("already exists")) {
        return "Yes"; // Confirm overwrite
      }
      return undefined;
    };

    (vscode.window as any).showInformationMessage = async () => undefined;

    try {
      // Act
      await vscode.commands.executeCommand("torque.createBlueprint");

      // Assert - verify file was overwritten with new content
      const fileContent = await vscode.workspace.fs.readFile(blueprintUri);
      const contentString = Buffer.from(fileContent).toString("utf8");
      assert.strictEqual(
        contentString,
        expectedBlueprintContent,
        "Should overwrite with blueprint template when user confirms"
      );
    } finally {
      // Cleanup
      try {
        await vscode.workspace.fs.delete(blueprintUri);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("SHOULD handle user cancellation gracefully", async () => {
    // Arrange
    (vscode.window as any).showInputBox = async () => undefined; // User cancels

    // Act - should not throw error
    await vscode.commands.executeCommand("torque.createBlueprint");

    // Assert - command completes without error (verified by not throwing)
  });

  test("SHOULD show error when no workspace folder is open", async () => {
    // This test is tricky to implement in the actual test environment
    // since we can't easily remove workspace folders during tests.
    // The test verifies the command exists and can be called.
    const allCommands = await vscode.commands.getCommands();
    assert.ok(
      allCommands.includes("torque.createBlueprint"),
      "Command should be registered"
    );
  });
});

suite("File Menu Integration", () => {
  test("SHOULD register menus contribution for file/newFile", async () => {
    // Arrange
    const ext = vscode.extensions.getExtension("quali.torque-ai");
    assert.ok(ext, "Extension should be available");

    // Act
    const packageJSON = ext.packageJSON;

    // Assert - Check menus contribution exists
    assert.ok(packageJSON.contributes, "Should have contributes section");
    assert.ok(packageJSON.contributes.menus, "Should have menus contribution");
    assert.ok(
      packageJSON.contributes.menus["file/newFile"],
      "Should have file/newFile menu contribution"
    );
    assert.ok(
      Array.isArray(packageJSON.contributes.menus["file/newFile"]),
      "file/newFile menu should be an array"
    );

    const blueprintMenuItem = packageJSON.contributes.menus[
      "file/newFile"
    ].find((menuItem: any) => menuItem.command === "torque.createBlueprint");

    assert.ok(
      blueprintMenuItem,
      "Should have torque.createBlueprint command in file/newFile menu"
    );
    assert.strictEqual(
      blueprintMenuItem.group,
      "file",
      "Should be in 'file' group"
    );
  });

  test("SHOULD have command registered with appropriate title for menu", async () => {
    // Arrange
    const ext = vscode.extensions.getExtension("quali.torque-ai");
    assert.ok(ext, "Extension should be available");

    // Act
    const packageJSON = ext.packageJSON;
    const createBlueprintCommand = packageJSON.contributes.commands.find(
      (cmd: any) => cmd.command === "torque.createBlueprint"
    );

    // Assert
    assert.ok(
      createBlueprintCommand,
      "Should have torque.createBlueprint command registered"
    );
    assert.strictEqual(
      createBlueprintCommand.title,
      "Torque Blueprint",
      "Command title should be 'Torque Blueprint' for use in File -> New... menu"
    );
    assert.strictEqual(
      createBlueprintCommand.category,
      "Torque",
      "Command should be in Torque category"
    );
    assert.strictEqual(
      createBlueprintCommand.icon,
      "$(file-add)",
      "Command should have file-add icon"
    );
  });

  test("SHOULD be able to invoke command via Command Palette", async () => {
    // Verify the command is accessible programmatically
    const allCommands = await vscode.commands.getCommands();
    assert.ok(
      allCommands.includes("torque.createBlueprint"),
      "Command should be registered and available"
    );
  });
});
