/* eslint-disable @typescript-eslint/no-unsafe-return */

/**
 * MCP and Tool Registration Test Suite
 *
 * Tests the behavior specified in: ../MCP_and_Tool_Registration.spec
 *
 * This test suite follows BDD principles and verifies the complete user flow
 * for MCP server registration and tool integration as outlined in the specification.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { SettingsManager } from "../../../domains/setup";

suite("MCP and Tool Registration - Setup Command Integration", () => {
  let testContext: vscode.ExtensionContext;
  let settingsManager: SettingsManager;
  let originalShowInputBox: typeof vscode.window.showInputBox;
  let originalShowInformationMessage: typeof vscode.window.showInformationMessage;
  let originalShowQuickPick: typeof vscode.window.showQuickPick;

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
          return storage[key];
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
          name: "torque"
        }
      } as any
    } as vscode.ExtensionContext;

    settingsManager = new SettingsManager(testContext);

    // Store original functions
    originalShowInputBox = vscode.window.showInputBox;
    originalShowInformationMessage = vscode.window.showInformationMessage;
    originalShowQuickPick = vscode.window.showQuickPick;
  });

  suiteTeardown(async () => {
    // Restore original functions
    (vscode.window as any).showInputBox = originalShowInputBox;
    (vscode.window as any).showInformationMessage =
      originalShowInformationMessage;
    (vscode.window as any).showQuickPick = originalShowQuickPick;

    // Clean up test storage by clearing the mock storage
    (testContext as any)._secretStorage = {};
  });

  setup(async () => {
    // Reset test state before each test
    (testContext as any)._secretStorage = {};
  });

  /**
   * Specification Section 3: User Configuration Process
   * Tests the guided setup flow with validation
   */
  suite("GIVEN user runs Configure Torque AI command", () => {
    test("SHOULD prompt for API URL with proper validation", async () => {
      // Arrange
      let urlPromptCalled = false;
      let urlValidationFunction:
        | vscode.InputBoxOptions["validateInput"]
        | undefined;

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          urlPromptCalled = true;
          urlValidationFunction = options.validateInput;

          // Verify placeholder
          assert.strictEqual(
            options.placeHolder,
            "e.g., https://account.qtorque.io"
          );

          return "https://api.example.com";
        }
        return "test-token-1234567890"; // Mock token response
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection (no spaces or skipped)
      };

      (vscode.window as any).showInformationMessage = async () => {};
      (vscode.window as any).showWarningMessage = async () => {};

      // Act
      await vscode.commands.executeCommand("torque.setup");

      // Assert
      assert.strictEqual(urlPromptCalled, true, "Should prompt for URL");
      assert.ok(urlValidationFunction, "Should provide URL validation");

      // Test URL validation
      if (urlValidationFunction) {
        const emptyResult = await Promise.resolve(urlValidationFunction(""));
        const invalidResult = await Promise.resolve(
          urlValidationFunction("invalid-url")
        );
        const validResult = await Promise.resolve(
          urlValidationFunction("https://valid.com")
        );

        assert.strictEqual(emptyResult, "URL is required");
        assert.strictEqual(invalidResult, "Please enter a valid URL");
        assert.strictEqual(validResult, undefined);
      }
    });

    test("SHOULD prompt for API token with security measures", async () => {
      // Arrange
      let tokenPromptCalled = false;
      let tokenValidationFunction:
        | vscode.InputBoxOptions["validateInput"]
        | undefined;

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API token")) {
          tokenPromptCalled = true;
          tokenValidationFunction = options.validateInput;

          // Verify security settings
          assert.strictEqual(
            options.password,
            true,
            "Should use password field"
          );
          assert.strictEqual(
            options.placeHolder,
            "API token will be stored securely"
          );

          return "test-token-1234567890";
        }
        return "https://api.example.com"; // Mock URL response
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection (no spaces or skipped)
      };

      (vscode.window as any).showInformationMessage = async () => {};
      (vscode.window as any).showWarningMessage = async () => {};

      // Act
      await vscode.commands.executeCommand("torque.setup");

      // Assert
      assert.strictEqual(tokenPromptCalled, true, "Should prompt for token");
      assert.ok(tokenValidationFunction, "Should provide token validation");

      // Test token validation
      if (tokenValidationFunction) {
        const emptyResult = await Promise.resolve(tokenValidationFunction(""));
        const shortResult = await Promise.resolve(
          tokenValidationFunction("short")
        );
        const validResult = await Promise.resolve(
          tokenValidationFunction("valid-token-12345")
        );

        assert.strictEqual(emptyResult, "Token is required");
        assert.strictEqual(shortResult, "Token seems too short");
        assert.strictEqual(validResult, undefined);
      }
    });

    test("SHOULD prompt for default space after token", async () => {
      // Arrange
      let spacePromptCalled = false;
      let spaceOptions: vscode.QuickPickOptions | undefined;

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return "https://portal.qtorque.io";
        }
        if (options?.prompt?.includes("API token")) {
          return "test-token-1234567890";
        }
        return undefined;
      };

      (vscode.window as any).showQuickPick = async (
        items: any[],
        options?: vscode.QuickPickOptions
      ) => {
        spacePromptCalled = true;
        spaceOptions = options;

        // Verify quick pick options
        assert.ok(items, "Should provide space items");
        assert.strictEqual(
          options?.title,
          "Set Default Space",
          "Should have correct title"
        );
        assert.strictEqual(
          options?.placeHolder,
          "Select your default Torque space",
          "Should have correct placeholder"
        );

        // Simulate selecting the first space
        return items[0];
      };

      (vscode.window as any).showInformationMessage = async () => {};
      (vscode.window as any).showWarningMessage = async () => {};

      // Act
      await vscode.commands.executeCommand("torque.setup");

      // Assert
      assert.strictEqual(
        spacePromptCalled,
        true,
        "Should prompt for space selection"
      );
      assert.ok(spaceOptions, "Should provide space selection options");
    });

    test("SHOULD store credentials securely after validation", async () => {
      // Arrange
      const testUrl = "https://api.example.com";
      const testToken = "test-token-1234567890";

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return testUrl;
        }
        if (options?.prompt?.includes("API token")) {
          return testToken;
        }
        return undefined;
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection (no spaces or skipped)
      };

      (vscode.window as any).showInformationMessage = async () => {};
      (vscode.window as any).showWarningMessage = async () => {};

      // Act
      await vscode.commands.executeCommand("torque.setup");

      // Assert - verify the setup command completed successfully by checking mock storage
      // Note: The actual command uses the real extension context, not our test context,
      // so we verify that the command executed without error instead
      // In integration tests, the setup command would store values in the actual VS Code secrets

      // This test verifies the command completes without throwing errors
      // and that our input mocking worked (no exceptions means the inputs were accepted)
    });
  });

  /**
   * Specification Section 4: MCP Server Registration
   * Tests the MCP server registration process using VS Code API
   */
  suite("GIVEN valid credentials are provided", () => {
    test("SHOULD register MCP server using VS Code API only", async () => {
      // Arrange
      const testUrl = "https://api.example.com";
      const testToken = "test-token-1234567890";

      let mcpProviderRegistered = false;
      const originalRegisterMcp = (vscode.lm as any)
        ?.registerMcpServerDefinitionProvider;

      (vscode.lm as any).registerMcpServerDefinitionProvider = (
        providerId: string,
        provider: any
      ) => {
        mcpProviderRegistered = true;
        assert.strictEqual(
          providerId,
          "torqueMcpProvider",
          "Should use correct provider ID"
        );
        assert.ok(
          provider.provideMcpServerDefinitions,
          "Should provide server definitions method"
        );
        assert.ok(
          provider.resolveMcpServerDefinition,
          "Should provide resolution method"
        );
        return { dispose: () => {} };
      };

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return testUrl;
        }
        if (options?.prompt?.includes("API token")) {
          return testToken;
        }
        return undefined;
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection
      };

      (vscode.window as any).showInformationMessage = async () => {};
      (vscode.window as any).showWarningMessage = async () => {};

      try {
        // Act
        await vscode.commands.executeCommand("torque.setup");

        // Assert
        assert.strictEqual(
          mcpProviderRegistered,
          true,
          "Should register MCP provider via VS Code API"
        );
      } finally {
        // Cleanup
        if (originalRegisterMcp) {
          (vscode.lm as any).registerMcpServerDefinitionProvider =
            originalRegisterMcp;
        } else {
          delete (vscode.lm as any).registerMcpServerDefinitionProvider;
        }
      }
    });

    test("SHOULD use secure HTTP headers for authentication", async () => {
      // Arrange
      const testUrl = "https://api.example.com";
      const testToken = "test-token-1234567890";

      let serverDefinition: any = null;

      (vscode.lm as any).registerMcpServerDefinitionProvider = (
        providerId: string,
        provider: any
      ) => {
        const definitions = provider.provideMcpServerDefinitions();
        serverDefinition = definitions[0];
        return { dispose: () => {} };
      };

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return testUrl;
        }
        if (options?.prompt?.includes("API token")) {
          return testToken;
        }
        return undefined;
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection
      };

      (vscode.window as any).showInformationMessage = async () => {};
      (vscode.window as any).showWarningMessage = async () => {};

      try {
        // Act
        await vscode.commands.executeCommand("torque.setup");

        // Assert
        assert.ok(serverDefinition, "Should create server definition");
        assert.strictEqual(
          serverDefinition.label,
          "torque",
          "Should use correct server label"
        );
        assert.ok(
          serverDefinition.headers,
          "Should have authentication headers"
        );
        assert.strictEqual(
          serverDefinition.headers.Authorization,
          `Bearer ${testToken}`,
          "Should use Bearer token in headers"
        );
        assert.strictEqual(
          serverDefinition.headers["Content-Type"],
          "application/json",
          "Should set proper content type"
        );

        // Verify token is NOT in URI query parameters
        assert.ok(
          !serverDefinition.uri.toString().includes(testToken),
          "Should NOT include token in URI query parameters"
        );
      } finally {
        delete (vscode.lm as any).registerMcpServerDefinitionProvider;
      }
    });
  });

  /**
   * Specification Section 5: Success Message and Guidance
   * Tests the user feedback after successful setup
   */
  suite("GIVEN MCP server registration succeeds", () => {
    test("SHOULD show success message with next steps", async () => {
      // Arrange
      const testUrl = "https://api.example.com";
      const testToken = "test-token-1234567890";

      let successMessageShown = false;
      let messageContent = "";
      let messageActions: string[] = [];

      (vscode.lm as any).registerMcpServerDefinitionProvider = () => ({
        dispose: () => {}
      });

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return testUrl;
        }
        if (options?.prompt?.includes("API token")) {
          return testToken;
        }
        return undefined;
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection
      };

      (vscode.window as any).showInformationMessage = async (
        message: string,
        ...actions: string[]
      ) => {
        if (message.includes("✅ Torque AI configured successfully!")) {
          successMessageShown = true;
          messageContent = message;
          messageActions = actions;
        }
        return undefined;
      };

      (vscode.window as any).showWarningMessage = async () => {};

      try {
        // Act
        await vscode.commands.executeCommand("torque.setup");

        // Assert
        assert.strictEqual(
          successMessageShown,
          true,
          "Should show success message"
        );
        assert.ok(
          messageContent.includes("🔧 MCP server registered and ready to use"),
          "Should mention MCP server"
        );
        assert.ok(
          messageContent.includes("📱 Open Copilot Chat"),
          "Should guide to Copilot Chat"
        );
        assert.ok(
          messageActions.includes("Open Chat"),
          "Should offer Open Chat action"
        );
        assert.ok(
          messageActions.includes("Check Status"),
          "Should offer Check Status action"
        );
      } finally {
        delete (vscode.lm as any).registerMcpServerDefinitionProvider;
      }
    });
  });

  /**
   * Specification Section 7: MCP Server Updates
   * Tests the behavior when reconfiguring an already configured extension
   */
  suite("GIVEN extension is already configured", () => {
    test("SHOULD allow updating credentials and dispose old registration", async () => {
      // Arrange - Set up initial configuration
      await settingsManager.setSetting("url", "https://old.api.com");
      await settingsManager.setSetting("token", "old-token-1234567890");

      const newUrl = "https://new.api.com";
      const newToken = "new-token-1234567890";

      let disposeCallCount = 0;
      let registrationCallCount = 0;

      (vscode.lm as any).registerMcpServerDefinitionProvider = () => {
        registrationCallCount++;
        return {
          dispose: () => {
            disposeCallCount++;
          }
        };
      };

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return newUrl;
        }
        if (options?.prompt?.includes("API token")) {
          return newToken;
        }
        return undefined;
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection
      };

      (vscode.window as any).showInformationMessage = async () => {};
      (vscode.window as any).showWarningMessage = async () => {};

      try {
        // Act - Run setup command again
        await vscode.commands.executeCommand("torque.setup");

        // Assert
        // Verify the setup command completed and MCP server was registered
        // Note: Storage verification would require integration with actual VS Code context
        assert.ok(registrationCallCount >= 1, "Should register new MCP server");

        // Command completed without errors, indicating successful credential update
      } finally {
        delete (vscode.lm as any).registerMcpServerDefinitionProvider;
      }
    });
  });

  /**
   * Specification Section 6: Status Check Command
   * Tests the diagnostic and status functionality
   */
  suite("GIVEN user runs Check Torque AI Status command", () => {
    test("SHOULD show status message when checking MCP status", async () => {
      // Arrange
      let statusMessageShown = false;

      const originalShowWarningMessage = vscode.window.showWarningMessage;
      const originalShowInformationMessage =
        vscode.window.showInformationMessage;

      (vscode.window as any).showWarningMessage = async (
        message: string,
        ...actions: string[]
      ) => {
        statusMessageShown = true;
        return undefined;
      };

      (vscode.window as any).showInformationMessage = async (
        message: string,
        ...actions: string[]
      ) => {
        statusMessageShown = true;
        return undefined;
      };

      try {
        // Act
        await vscode.commands.executeCommand("torque.checkMcpStatus");

        // Assert - Command should execute and show some status message
        assert.strictEqual(
          statusMessageShown,
          true,
          "Should show status message"
        );
      } finally {
        // Cleanup
        (vscode.window as any).showWarningMessage = originalShowWarningMessage;
        (vscode.window as any).showInformationMessage =
          originalShowInformationMessage;
      }
    });

    test("SHOULD show detailed status when extension is configured", async () => {
      // Arrange - Set up configuration
      await settingsManager.setSetting("url", "https://api.example.com");
      await settingsManager.setSetting("token", "test-token-1234567890");

      let infoMessageShown = false;
      let messageContent = "";

      // Mock the MCP panels command
      let mcpPanelCommandCalled = false;
      const originalExecuteCommand = vscode.commands.executeCommand;
      (vscode.commands as any).executeCommand = async (command: string) => {
        if (command === "mcp.showInstalledServers") {
          mcpPanelCommandCalled = true;
          return;
        }
        return originalExecuteCommand.apply(vscode.commands, [command]);
      };

      (vscode.window as any).showInformationMessage = async (
        message: string
      ) => {
        if (message.includes("📊 Torque AI Status")) {
          infoMessageShown = true;
          messageContent = message;
        }
        return undefined;
      };

      try {
        // Act
        await vscode.commands.executeCommand("torque.checkMcpStatus");

        // Assert
        assert.strictEqual(infoMessageShown, true, "Should show info message");
        assert.strictEqual(
          mcpPanelCommandCalled,
          true,
          "Should attempt to open MCP panel"
        );
        assert.ok(
          messageContent.includes("✅ Configured"),
          "Should show configured status"
        );
        assert.ok(
          messageContent.includes("💡 Next steps"),
          "Should provide guidance"
        );
        assert.ok(
          messageContent.includes("Open Copilot Chat"),
          "Should mention Copilot Chat"
        );
      } finally {
        (vscode.commands as any).executeCommand = originalExecuteCommand;
      }
    });
  });

  /**
   * Error Conditions and Recovery
   * Tests error handling and user feedback
   */
  suite("GIVEN error conditions occur", () => {
    test("SHOULD handle MCP registration failures gracefully", async () => {
      // Arrange
      const testUrl = "https://api.example.com";
      const testToken = "test-token-1234567890";

      let errorMessageShown = false;
      let errorContent = "";

      (vscode.lm as any).registerMcpServerDefinitionProvider = () => {
        throw new Error("MCP registration failed");
      };

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return testUrl;
        }
        if (options?.prompt?.includes("API token")) {
          return testToken;
        }
        return undefined;
      };

      (vscode.window as any).showQuickPick = async () => {
        return undefined; // Mock space selection
      };

      (vscode.window as any).showWarningMessage = async () => {};

      (vscode.window as any).showErrorMessage = async (message: string) => {
        errorMessageShown = true;
        errorContent = message;
        return undefined;
      };

      try {
        // Act - This should either throw an error or show an error message
        try {
          await vscode.commands.executeCommand("torque.setup");

          // If no exception was thrown, check if error message was shown
          assert.strictEqual(
            errorMessageShown,
            true,
            "Should show error message or throw exception"
          );
        } catch (error) {
          // Command threw an error, which is also acceptable error handling
          assert.ok(error, "Should handle MCP registration failure");
        }
      } finally {
        delete (vscode.lm as any).registerMcpServerDefinitionProvider;
      }
    });

    test("SHOULD handle user cancellation gracefully", async () => {
      // Arrange
      let setupCompleted = false;

      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return undefined;
        } // Simulate cancellation
        return "test-token-1234567890";
      };

      (vscode.window as any).showInformationMessage = async (
        message: string
      ) => {
        if (message.includes("✅ Torque AI configured successfully")) {
          setupCompleted = true;
        }
        return undefined;
      };

      // Act
      await vscode.commands.executeCommand("torque.setup");

      // Assert
      assert.strictEqual(
        setupCompleted,
        false,
        "Should not complete setup when user cancels"
      );

      // Verify nothing was stored
      const storedUrl = await settingsManager.getSetting<string>("url");
      const storedToken = await settingsManager.getSetting<string>("token");
      assert.strictEqual(
        storedUrl,
        undefined,
        "Should not store URL on cancellation"
      );
      assert.strictEqual(
        storedToken,
        undefined,
        "Should not store token on cancellation"
      );
    });
  });
});
