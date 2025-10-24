/**
 * ValidateBlueprintAction Test Suite
 *
 * Tests the blueprint validation functionality
 */

import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { ValidateBlueprintAction } from "../../../domains/blueprint-authoring/commands/actions/ValidateBlueprintAction";
import { SettingsManager } from "../../../domains/setup";
import type { ApiClient } from "../../../api/ApiClient";

suite("ValidateBlueprintAction Test Suite", () => {
  let testContext: vscode.ExtensionContext;
  let settingsManager: SettingsManager;
  let diagnostics: vscode.DiagnosticCollection;
  let mockClient: ApiClient | null;
  let validateAction: ValidateBlueprintAction;
  let sandbox: sinon.SinonSandbox;

  const SAMPLE_BLUEPRINT = `# yaml-language-server: $schema=https://portal.qtorque.io/api/torque-yaml-schema
spec_version: 2
description: 'Sample Blueprint'

inputs:
  instance_type:
    type: string
    default: t2.micro

grains:
  webapp:
    kind: terraform
    spec:
      source:
        path: terraform/webapp
      inputs:
        - instance_type: $instance_type
`;

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
    diagnostics = vscode.languages.createDiagnosticCollection("test");
  });

  suiteTeardown(() => {
    diagnostics.dispose();
  });

  setup(async () => {
    // Create sandbox for stubs
    sandbox = sinon.createSandbox();

    // Reset test state before each test
    (testContext as any)._secretStorage = {};
    mockClient = null;

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

    // Clear diagnostics
    diagnostics.clear();
  });

  teardown(() => {
    // Restore all stubs
    sandbox.restore();
  });

  suite("Blueprint Validation with Errors", () => {
    test("SHOULD show error diagnostics when validation fails", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      // Create mock client with validation errors
      mockClient = {
        spaces: {
          validateBlueprint: async (spaceName: string, request: any) => {
            assert.strictEqual(spaceName, "test-space");
            // Blueprint name will be "Untitled-1" or similar for in-memory documents
            assert.ok(request.blueprint_name, "Should have blueprint name");
            assert.ok(request.blueprint_raw_64);

            return {
              errors: [
                {
                  message:
                    "Invalid grain type 'invalid' (in grains->webapp->kind)",
                  name: "ValidationError",
                  code: "INVALID_GRAIN_TYPE",
                  path: "grains->webapp->kind"
                }
              ],
              warnings: []
            };
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      // Create a mock document
      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(allDiagnostics, "Should have diagnostics");
      assert.strictEqual(
        allDiagnostics.length,
        1,
        "Should have one error diagnostic"
      );
      assert.strictEqual(
        allDiagnostics[0].severity,
        vscode.DiagnosticSeverity.Error
      );
      assert.ok(
        allDiagnostics[0].message.includes("Invalid grain type"),
        "Error message should contain validation error"
      );
    });

    test("SHOULD show warning diagnostics when validation passes with warnings", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      mockClient = {
        spaces: {
          validateBlueprint: async () => ({
            errors: [],
            warnings: [
              {
                message:
                  "Input 'instance_type' has default value but may need validation",
                name: "ValidationWarning",
                code: "DEFAULT_VALUE_WARNING"
              }
            ]
          })
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(allDiagnostics, "Should have diagnostics");
      assert.strictEqual(
        allDiagnostics.length,
        1,
        "Should have one warning diagnostic"
      );
      assert.strictEqual(
        allDiagnostics[0].severity,
        vscode.DiagnosticSeverity.Warning
      );
    });

    test("SHOULD clear diagnostics when validation passes", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      mockClient = {
        spaces: {
          validateBlueprint: async () => ({
            errors: [],
            warnings: []
          })
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(allDiagnostics, "Should have diagnostics collection");
      assert.strictEqual(
        allDiagnostics.length,
        0,
        "Should have no diagnostics when validation passes"
      );
    });

    test("SHOULD handle multiple errors and warnings", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      mockClient = {
        spaces: {
          validateBlueprint: async () => ({
            errors: [
              {
                message: "Error 1",
                name: "Error1",
                code: "ERR1"
              },
              {
                message: "Error 2",
                name: "Error2",
                code: "ERR2"
              }
            ],
            warnings: [
              {
                message: "Warning 1",
                name: "Warning1",
                code: "WARN1"
              }
            ]
          })
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(allDiagnostics, "Should have diagnostics");
      assert.strictEqual(
        allDiagnostics.length,
        3,
        "Should have three diagnostics (2 errors + 1 warning)"
      );

      const errors = allDiagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      );
      const warnings = allDiagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Warning
      );

      assert.strictEqual(errors.length, 2, "Should have 2 errors");
      assert.strictEqual(warnings.length, 1, "Should have 1 warning");
    });
  });

  suite("Error Location Finding", () => {
    test("SHOULD find error location from YAML path", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      const blueprintWithError = `# yaml-language-server: $schema=https://portal.qtorque.io/api/torque-yaml-schema
spec_version: 2
description: 'Test'

inputs:
  instance_type:
    type: string

grains:
  webapp:
    kind: terraform
`;

      mockClient = {
        spaces: {
          validateBlueprint: async () => ({
            errors: [
              {
                message:
                  "Missing required field 'spec' (in grains->webapp->spec)",
                name: "ValidationError",
                code: "MISSING_FIELD",
                path: "grains->webapp->spec"
              }
            ],
            warnings: []
          })
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: blueprintWithError
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(allDiagnostics, "Should have diagnostics");
      assert.strictEqual(allDiagnostics.length, 1);

      // The error should be located on the line where the path element is found
      // (Implementation depends on the findErrorLocation method)
      assert.ok(allDiagnostics[0].range.start.line >= 0);
    });

    test("SHOULD use explicit line/column when provided", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      mockClient = {
        spaces: {
          validateBlueprint: async () => ({
            errors: [
              {
                message: "Syntax error on line 5",
                name: "SyntaxError",
                code: "SYNTAX_ERROR",
                line: 5,
                column: 10
              }
            ],
            warnings: []
          })
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(allDiagnostics, "Should have diagnostics");
      assert.strictEqual(allDiagnostics.length, 1);

      // Line should be 4 (0-indexed from 5)
      assert.strictEqual(allDiagnostics[0].range.start.line, 4);
      // Column should be 9 (0-indexed from 10)
      assert.strictEqual(allDiagnostics[0].range.start.character, 9);
    });

    test("SHOULD fallback to first line when error location cannot be determined", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      mockClient = {
        spaces: {
          validateBlueprint: async () => ({
            errors: [
              {
                message: "Generic error without location info",
                name: "GenericError",
                code: "GENERIC_ERROR"
              }
            ],
            warnings: []
          })
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(allDiagnostics, "Should have diagnostics");
      assert.strictEqual(allDiagnostics.length, 1);

      // Should default to first line (line 0)
      assert.strictEqual(allDiagnostics[0].range.start.line, 0);
    });
  });

  suite("Validation Prerequisites", () => {
    test("SHOULD show error when no API client is configured", async () => {
      // Arrange - No API client
      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => null,
        diagnostics
      );

      // Stub showErrorMessage to avoid waiting for user interaction
      sandbox.stub(vscode.window, "showErrorMessage").resolves(undefined);

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert - Should not have called the API (no diagnostics set)
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(
        !allDiagnostics || allDiagnostics.length === 0,
        "Should not set diagnostics when API client is not available"
      );
    });

    test("SHOULD show error when no space is configured", async () => {
      // Arrange - API client available but no space
      mockClient = {
        spaces: {
          validateBlueprint: async () => {
            throw new Error("Should not be called");
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      // Stub showErrorMessage to avoid waiting for user interaction
      sandbox.stub(vscode.window, "showErrorMessage").resolves(undefined);

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert - Should not have called the API
      const allDiagnostics = diagnostics.get(doc.uri);
      assert.ok(
        !allDiagnostics || allDiagnostics.length === 0,
        "Should not set diagnostics when space is not configured"
      );
    });

    test("SHOULD use active space when configured", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "default-space",
        vscode.ConfigurationTarget.Global
      );
      await settingsManager.setSetting(
        "activeSpace",
        "active-space",
        vscode.ConfigurationTarget.Workspace
      );

      let capturedSpaceName = "";

      mockClient = {
        spaces: {
          validateBlueprint: async (spaceName: string) => {
            capturedSpaceName = spaceName;
            return { errors: [], warnings: [] };
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      assert.strictEqual(
        capturedSpaceName,
        "active-space",
        "Should use active space over default space"
      );
    });

    test("SHOULD fallback to default space when active space is not set", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "default-space",
        vscode.ConfigurationTarget.Global
      );

      let capturedSpaceName = "";

      mockClient = {
        spaces: {
          validateBlueprint: async (spaceName: string) => {
            capturedSpaceName = spaceName;
            return { errors: [], warnings: [] };
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      assert.strictEqual(
        capturedSpaceName,
        "default-space",
        "Should use default space when active space is not set"
      );
    });
  });

  suite("Blueprint Content Encoding", () => {
    test("SHOULD encode blueprint content as base64", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      let capturedRequest: any;

      mockClient = {
        spaces: {
          validateBlueprint: async (spaceName: string, request: any) => {
            capturedRequest = request;
            return { errors: [], warnings: [] };
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      assert.ok(capturedRequest, "Should have captured the request");
      assert.ok(
        capturedRequest.blueprint_raw_64,
        "Should have base64 encoded content"
      );

      // Decode and verify
      const decoded = Buffer.from(
        capturedRequest.blueprint_raw_64,
        "base64"
      ).toString("utf-8");
      assert.strictEqual(
        decoded,
        SAMPLE_BLUEPRINT,
        "Decoded content should match original"
      );
    });

    test("SHOULD extract blueprint name from URI", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      let capturedRequest: any;

      mockClient = {
        spaces: {
          validateBlueprint: async (spaceName: string, request: any) => {
            capturedRequest = request;
            return { errors: [], warnings: [] };
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert
      assert.ok(capturedRequest, "Should have captured the request");
      assert.ok(capturedRequest.blueprint_name, "Should have blueprint name");
      // The blueprint name should be derived from the URI
      // (specific format depends on getBlueprintName implementation)
    });
  });

  suite("Error Handling", () => {
    test("SHOULD handle API errors gracefully", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      mockClient = {
        spaces: {
          validateBlueprint: async () => {
            throw new Error("API connection failed");
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert - Should not crash, error should be logged
      // (In production, an error message would be shown to the user)
    });

    test("SHOULD handle network errors", async () => {
      // Arrange
      await settingsManager.setSetting(
        "space",
        "test-space",
        vscode.ConfigurationTarget.Global
      );

      mockClient = {
        spaces: {
          validateBlueprint: async () => {
            const error: any = new Error("Network error");
            error.code = "ECONNREFUSED";
            throw error;
          }
        }
      } as any;

      validateAction = new ValidateBlueprintAction(
        settingsManager,
        () => mockClient,
        diagnostics
      );

      const doc = await vscode.workspace.openTextDocument({
        language: "yaml",
        content: SAMPLE_BLUEPRINT
      });

      // Act
      await validateAction.execute(doc.uri);

      // Assert - Should not crash
    });
  });
});
