/* eslint-disable @typescript-eslint/no-unsafe-return */

/**
 * API Integration Test
 *
 * This test focuses on testing the API integration without relying on MCP setup.
 * It tests:
 * 1. Mock server setup with authentication
 * 2. Direct API client usage
 * 3. Environment details tool functionality
 * 4. Server request verification
 */

import * as assert from "assert";
import type * as vscode from "vscode";
import { MockTorqueServer } from "../mockServer";
import { ApiClient } from "../../../api/ApiClient";
import { TorqueEnvironmentDetailsTool } from "../../../domains/environment-context";

suite("API Integration Test", () => {
  let mockServer: MockTorqueServer;
  let serverPort: number;
  let serverUrl: string;

  suiteSetup(async () => {
    // Start mock server
    mockServer = new MockTorqueServer({ requireAuth: true });
    serverPort = await mockServer.start();
    serverUrl = mockServer.getBaseUrl();

    console.log(`Mock server started on port ${serverPort}`);
  });

  suiteTeardown(async () => {
    // Stop mock server
    if (mockServer) {
      await mockServer.stop();
      console.log("Mock server stopped");
    }
  });

  setup(() => {
    // Clear request log before each test
    mockServer.clearRequestLog();
  });

  /**
   * Test 1: Verify mock server is working
   */
  test("SHOULD have functional mock server with authentication", async () => {
    const testToken = "test-token-server-check";

    // Test authenticated request
    const response = await fetch(
      `${serverUrl}/api/spaces/test-space/environments/test-env`,
      {
        headers: {
          Authorization: `Bearer ${testToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    assert.strictEqual(
      response.status,
      200,
      "Server should respond with 200 for authenticated request"
    );

    const data = await response.json();
    assert.ok(data.owner, "Response should contain owner information");
    assert.ok(data.cost, "Response should contain cost information");
    assert.ok(data.details, "Response should contain details");

    console.log("Mock server verification successful");
  });

  /**
   * Test 2: Verify authentication is required
   */
  test("SHOULD reject requests without authentication", async () => {
    // Test unauthenticated request
    const response = await fetch(
      `${serverUrl}/api/spaces/test-space/environments/test-env`
    );

    assert.strictEqual(
      response.status,
      401,
      "Server should respond with 401 for unauthenticated request"
    );

    const data = await response.json();
    assert.ok(data.error, "Response should contain error message");
    assert.ok(
      data.error.includes("Authorization"),
      "Error should mention authorization"
    );

    console.log("Authentication requirement verified");
  });

  /**
   * Test 3: Test ApiClient directly
   */
  test("SHOULD make successful API calls through ApiClient", async () => {
    const testToken = "test-token-api-client";

    // Create API client instance
    const apiClient = new ApiClient(serverUrl, testToken);

    // Make request directly through the client
    try {
      const response = await apiClient.client.get(
        "/api/spaces/direct-test/environments/direct-env"
      );

      assert.ok(response.data, "Response should contain data");
      assert.ok(
        response.data.owner,
        "Response should contain owner information"
      );
      assert.strictEqual(
        response.status,
        200,
        "Response should have 200 status"
      );

      console.log("Direct API client test successful");
    } catch (error) {
      assert.fail(
        `API client request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  /**
   * Test 4: Test environment details tool with mock API client
   */
  test("SHOULD fetch environment details through tool", async () => {
    const testToken = "test-token-tool-test";
    const testSpaceName = "tool-test-space";
    const testEnvironmentId = "tool-test-env";

    // Create a custom tool instance that uses our mock server
    class TestEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
      protected getApiClient() {
        const client = new ApiClient(serverUrl, testToken);
        return client;
      }
    }

    const tool = new TestEnvironmentDetailsTool();

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

    console.log("Environment details tool test successful");
  });

  /**
   * Test 5: Verify server request logging
   */
  test("SHOULD log server requests correctly", async () => {
    const testToken = "test-token-logging";
    const testSpaceName = "logging-space";
    const testEnvironmentId = "logging-env";

    // Clear previous requests
    mockServer.clearRequestLog();

    // Create tool and make request
    class TestEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
      protected getApiClient() {
        const client = new ApiClient(serverUrl, testToken);
        return client;
      }
    }

    const tool = new TestEnvironmentDetailsTool();
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

    console.log("Request logging verification successful");
    console.log(
      `Logged request: space="${request.spaceName}", environment="${request.environmentId}"`
    );
  });

  /**
   * Test 6: Test URL encoding in requests
   */
  test("SHOULD properly encode special characters in URLs", async () => {
    const testToken = "test-token-encoding";
    const testSpaceName = "space with spaces";
    const testEnvironmentId = "env/with/slashes";

    mockServer.clearRequestLog();

    class TestEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
      protected getApiClient() {
        const client = new ApiClient(serverUrl, testToken);
        return client;
      }
    }

    const tool = new TestEnvironmentDetailsTool();
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

    // Verify the request succeeded
    const resultText = result.content
      .map((item: any) => item.value || "")
      .join("");

    assert.ok(
      !resultText.includes("❌ **Error**"),
      "Result should not contain error message"
    );

    // Verify server received properly decoded values
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
      "Server should receive properly decoded space name"
    );
    assert.strictEqual(
      request.environmentId,
      testEnvironmentId,
      "Server should receive properly decoded environment ID"
    );

    console.log("URL encoding test successful");
  });

  /**
   * Test 7: Test response format consistency
   */
  test("SHOULD return consistent response format", async () => {
    const testToken = "test-token-format";
    const testSpaceName = "format-space";
    const testEnvironmentId = "format-env";

    class TestEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
      protected getApiClient() {
        const client = new ApiClient(serverUrl, testToken);
        return client;
      }
    }

    const tool = new TestEnvironmentDetailsTool();
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

    console.log("Response format consistency verified");
  });
});
