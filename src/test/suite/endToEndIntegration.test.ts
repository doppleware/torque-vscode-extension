/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

/**
 * End-to-End Integration Test
 *
 * This test creates a mock Torque server and tests the complete flow:
 * 1. Start mock server with environment details endpoint
 * 2. Install and activate extension
 * 3. Configure extension with mock server URL and token
 * 4. Verify API calls are made correctly
 * 5. Verify server receives requests with proper authentication
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { MockTorqueServer } from "./mockServer";
import { TorqueEnvironmentDetailsTool } from "../../tools/TorqueLanguageModelTools";

suite("End-to-End Integration Test", () => {
  let mockServer: MockTorqueServer;
  let serverPort: number;
  let serverUrl: string;
  let originalShowInputBox: typeof vscode.window.showInputBox;
  let originalShowInformationMessage: typeof vscode.window.showInformationMessage;
  let originalShowErrorMessage: typeof vscode.window.showErrorMessage;

  suiteSetup(async () => {
    // Store original VS Code functions
    originalShowInputBox = vscode.window.showInputBox;
    originalShowInformationMessage = vscode.window.showInformationMessage;
    originalShowErrorMessage = vscode.window.showErrorMessage;

    // Start mock server
    mockServer = new MockTorqueServer({ requireAuth: true });
    serverPort = await mockServer.start();
    serverUrl = mockServer.getBaseUrl();

    console.log(`Mock server started on port ${serverPort}`);
  });

  suiteTeardown(async () => {
    // Restore original VS Code functions
    (vscode.window as any).showInputBox = originalShowInputBox;
    (vscode.window as any).showInformationMessage =
      originalShowInformationMessage;
    (vscode.window as any).showErrorMessage = originalShowErrorMessage;

    // Stop mock server
    if (mockServer) {
      await mockServer.stop();
      console.log("Mock server stopped");
    }
  });

  setup(() => {
    // Clear request log before each test
    mockServer.clearRequestLog();

    // Reset mock functions
    (vscode.window as any).showInputBox = originalShowInputBox;
    (vscode.window as any).showInformationMessage =
      originalShowInformationMessage;
    (vscode.window as any).showErrorMessage = originalShowErrorMessage;
  });

  /**
   * Test 1: Extension Installation and Activation
   */
  test("SHOULD install and activate extension without errors", async () => {
    // Get the extension
    const ext = vscode.extensions.getExtension("torque.extension");
    assert.ok(ext, "Extension should be available");

    // Activate the extension
    await ext.activate();
    assert.strictEqual(ext.isActive, true, "Extension should be active");

    // Verify no errors in output (this is checked by examining that activation completed successfully)
    console.log("Extension activated successfully");
  });

  /**
   * Test 2: Configure Extension with Mock Server
   */
  test("SHOULD configure extension with mock server URL and token", async () => {
    const testToken = "test-token-1234567890-integration";
    let setupCompleted = false;

    // Mock the input prompts
    (vscode.window as any).showInputBox = async (
      options: vscode.InputBoxOptions
    ) => {
      if (options?.prompt?.includes("API URL")) {
        return serverUrl;
      }
      if (options?.prompt?.includes("API token")) {
        return testToken;
      }
      return undefined;
    };

    // Mock success message to detect completion
    (vscode.window as any).showInformationMessage = async (message: string) => {
      if (message.includes("✅ Torque AI configured successfully!")) {
        setupCompleted = true;
      }
      return undefined;
    };

    // Mock error messages to detect failures
    let errorOccurred = false;
    (vscode.window as any).showErrorMessage = async (message: string) => {
      errorOccurred = true;
      console.error("Setup error:", message);
      return undefined;
    };

    // Execute the setup command
    await vscode.commands.executeCommand("torque.setup");

    // Verify setup completed successfully
    assert.strictEqual(
      errorOccurred,
      false,
      "Setup should not show error messages"
    );
    assert.strictEqual(
      setupCompleted,
      true,
      "Setup should complete successfully"
    );

    console.log(`Extension configured with server: ${serverUrl}`);
  });

  /**
   * Test 3: Verify API Integration with Environment Details Tool
   */
  test("SHOULD make authenticated API calls to mock server", async () => {
    const testToken = "test-token-api-integration";
    const testSpaceName = "test-space";
    const testEnvironmentId = "test-env-123";

    // Create API client for testing
    const ApiClient = require("../../api/ApiClient").ApiClient;
    const apiClient = new ApiClient(serverUrl, testToken);

    // Create a test version of the tool that uses our API client
    class TestTorqueEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
      protected getApiClient() {
        return apiClient;
      }
    }

    // Create and invoke the test tool
    const tool = new TestTorqueEnvironmentDetailsTool();

    const mockOptions = {
      input: {
        space_name: testSpaceName,
        environment_id: testEnvironmentId
      },
      toolInvocationToken: undefined
    } as vscode.LanguageModelToolInvocationOptions<{
      space_name: string;
      environment_id: string;
    }>;

    // Invoke the tool
    const result = await tool.invoke(mockOptions);

    // Verify the result
    assert.ok(result, "Tool should return a result");
    assert.ok(result.content, "Result should have content");
    assert.ok(result.content.length > 0, "Result should have content items");

    // Check if the result contains environment details (not an error)
    const resultText = result.content
      .map((item: any) => item.value || "")
      .join("");

    assert.ok(
      !resultText.includes("❌ **Error**"),
      "Result should not contain error message"
    );
    assert.ok(
      resultText.includes("Environment Details"),
      "Result should contain environment details"
    );
    assert.ok(
      resultText.includes(testEnvironmentId),
      "Result should contain the environment ID"
    );

    console.log("API call completed successfully");
  });

  /**
   * Test 4: Verify Server Received Authenticated Request
   */
  test("SHOULD verify server received authenticated request with correct parameters", async () => {
    const testToken = "test-token-server-verification";
    const testSpaceName = "integration-space";
    const testEnvironmentId = "integration-env-456";

    // Create API client for testing
    const ApiClient = require("../../api/ApiClient").ApiClient;
    const apiClient = new ApiClient(serverUrl, testToken);

    // Create a test version of the tool that uses our API client
    class TestTorqueEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
      protected getApiClient() {
        return apiClient;
      }
    }

    // Clear previous requests
    mockServer.clearRequestLog();

    // Make API call via tool
    const tool = new TestTorqueEnvironmentDetailsTool();
    const mockOptions = {
      input: {
        space_name: testSpaceName,
        environment_id: testEnvironmentId
      },
      toolInvocationToken: undefined
    } as vscode.LanguageModelToolInvocationOptions<{
      space_name: string;
      environment_id: string;
    }>;

    await tool.invoke(mockOptions);

    // Verify server received the request
    const requestLog = mockServer.getRequestLog();
    assert.strictEqual(
      requestLog.length,
      1,
      "Server should receive exactly one request"
    );

    const request = requestLog[0];
    assert.strictEqual(
      request.spaceName,
      testSpaceName,
      "Server should receive correct space name"
    );
    assert.strictEqual(
      request.environmentId,
      testEnvironmentId,
      "Server should receive correct environment ID"
    );

    console.log("Server verification completed successfully");
    console.log(
      `Received request: space="${request.spaceName}", environment="${request.environmentId}"`
    );
  });

  /**
   * Test 5: Verify Authentication Failure Handling
   */
  test("SHOULD handle authentication failures gracefully", async () => {
    // Create a server that requires auth but configure extension without token
    const serverWithAuth = new MockTorqueServer({ requireAuth: true });
    const authServerPort = await serverWithAuth.start();
    const authServerUrl = serverWithAuth.getBaseUrl();

    try {
      // Configure extension without proper token
      (vscode.window as any).showInputBox = async (
        options: vscode.InputBoxOptions
      ) => {
        if (options?.prompt?.includes("API URL")) {
          return authServerUrl;
        }
        if (options?.prompt?.includes("API token")) {
          return ""; // Empty token should cause auth failure
        }
        return undefined;
      };

      (vscode.window as any).showInformationMessage = async () => undefined;

      await vscode.commands.executeCommand("torque.setup");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to make API call - this should fail due to auth
      const tool = new TorqueEnvironmentDetailsTool();
      const mockOptions = {
        input: {
          space_name: "test-space",
          environment_id: "test-env"
        },
        toolInvocationToken: undefined
      } as vscode.LanguageModelToolInvocationOptions<{
        space_name: string;
        environment_id: string;
      }>;

      const result = await tool.invoke(mockOptions);

      // Should return error result, not throw exception
      assert.ok(result, "Tool should return a result even on auth failure");

      const resultText = result.content
        .map((item: any) => item.value || "")
        .join("");

      assert.ok(
        resultText.includes("❌ **Error**"),
        "Result should contain error message for auth failure"
      );

      console.log("Authentication failure handled gracefully");
    } finally {
      await serverWithAuth.stop();
    }
  });

  /**
   * Test 6: Verify Non-Error Response Format
   */
  test("SHOULD return properly formatted non-error response", async () => {
    const testToken = "test-token-response-format";
    const testSpaceName = "format-test-space";
    const testEnvironmentId = "format-test-env";

    // Create API client for testing
    const ApiClient = require("../../api/ApiClient").ApiClient;
    const apiClient = new ApiClient(serverUrl, testToken);

    // Create a test version of the tool that uses our API client
    class TestTorqueEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
      protected getApiClient() {
        return apiClient;
      }
    }

    // Make API call
    const tool = new TestTorqueEnvironmentDetailsTool();
    const mockOptions = {
      input: {
        space_name: testSpaceName,
        environment_id: testEnvironmentId
      },
      toolInvocationToken: undefined
    } as vscode.LanguageModelToolInvocationOptions<{
      space_name: string;
      environment_id: string;
    }>;

    const result = await tool.invoke(mockOptions);

    // Verify response format
    const resultText = result.content
      .map((item: any) => item.value || "")
      .join("");

    // Should contain expected environment details sections
    assert.ok(
      resultText.includes("## Environment Details:"),
      "Should have environment details header"
    );
    assert.ok(
      resultText.includes("**Space**:"),
      "Should show space information"
    );
    assert.ok(
      resultText.includes("**Environment ID**:"),
      "Should show environment ID"
    );
    assert.ok(
      resultText.includes("👤 **Owner**:"),
      "Should show owner information"
    );
    assert.ok(
      resultText.includes("💰 **Cost**:"),
      "Should show cost information"
    );
    assert.ok(
      resultText.includes("🕒 **Last Used**:"),
      "Should show last used information"
    );

    // Should not contain error indicators
    assert.ok(
      !resultText.includes("❌"),
      "Should not contain error indicators"
    );
    assert.ok(
      !resultText.includes("Failed to fetch"),
      "Should not contain error messages"
    );

    console.log("Response format verification completed");
    console.log(
      "Sample response preview:",
      resultText.substring(0, 200) + "..."
    );
  });
});
