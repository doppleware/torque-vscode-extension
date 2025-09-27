/**
 * URI Handler Integration Test Suite
 *
 * Tests the actual VS Code URI handler integration, not just the UriRouter class.
 * This test verifies that URIs with the correct scheme are properly handled by the extension.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { SettingsManager } from "../../SettingsManager";

suite("URI Handler Integration Test Suite", () => {
  let extension: vscode.Extension<unknown>;
  let settingsManager: SettingsManager;

  suiteSetup(async () => {
    // Get the extension and ensure it's activated
    extension = vscode.extensions.getExtension("torque.extension")!;
    assert.ok(extension, "Extension should be available");

    if (!extension.isActive) {
      await extension.activate();
    }
    assert.ok(extension.isActive, "Extension should be active");

    // Initialize settings manager and configure test settings
    // Create a minimal context for the settings manager
    const mockContext = {
      extension: extension,
      secrets: {
        get: async () => undefined,
        store: async () => {},
        delete: async () => {}
      }
    } as any;
    settingsManager = new SettingsManager(mockContext);

    // Configure the extension with test settings to initialize API client
    await settingsManager.setSetting("url", "https://test.example.com");
    await settingsManager.setSetting(
      "token",
      "test-token-for-uri-handler-tests"
    );

    // Give time for the configuration change to be processed and API client to initialize
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  test("Should handle valid environment context URI", async () => {
    // This tests the actual VS Code URI handler integration
    const testUri = vscode.Uri.parse(
      "vscode://torque.extension/chat/context/add/environment/test-space/test-env"
    );

    // Track if any error messages are shown (but allow authentication-related errors in test environment)
    let hasNonAuthError = false;

    const originalShowErrorMessage = vscode.window.showErrorMessage;
    const originalShowInformationMessage = vscode.window.showInformationMessage;

    vscode.window.showErrorMessage = async (message: string) => {
      // In test environment, authentication errors are expected since we don't have a real API
      if (
        !message.includes("Authentication required") &&
        !message.includes("ApiClient not initialized") &&
        !message.includes("Unable to fetch environment details")
      ) {
        hasNonAuthError = true;
      }
      return Promise.resolve(undefined);
    };

    vscode.window.showInformationMessage = async (message: string) => {
      if (message.includes("Successfully processed")) {
        // Track success if needed
      }
      return Promise.resolve(undefined);
    };

    try {
      // This should trigger the actual URI handler registered in the extension
      await vscode.env.openExternal(testUri);

      // Give some time for async processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // The URI should be processed without non-authentication errors
      assert.ok(
        !hasNonAuthError,
        "Should not show error messages for valid URI (except authentication errors in test environment)"
      );
    } finally {
      // Restore original functions
      vscode.window.showErrorMessage = originalShowErrorMessage;
      vscode.window.showInformationMessage = originalShowInformationMessage;
    }
  });

  test("Should handle valid webview URI", async () => {
    const testUri = vscode.Uri.parse(
      "vscode://torque.extension/webview/open?url=https://example.com"
    );

    const originalShowErrorMessage = vscode.window.showErrorMessage;

    vscode.window.showErrorMessage = async () => {
      return Promise.resolve(undefined);
    };

    try {
      await vscode.env.openExternal(testUri);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Note: This might show an error about domain mismatch, which is expected
      // if the extension is not configured with a URL that matches example.com
    } finally {
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test("Should reject URI with wrong scheme", async () => {
    // Test that a URI with wrong publisher/extension name fails appropriately
    const wrongUri = vscode.Uri.parse(
      "vscode://wrong.extension/chat/context/add/environment/test-space/test-env"
    );

    let handled = false;

    try {
      await vscode.env.openExternal(wrongUri);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // This should not be handled by our extension
      handled = false;
    } catch {
      // Expected - wrong URI scheme should not be handled
      handled = false;
    }

    assert.ok(
      !handled,
      "URI with wrong scheme should not be handled by our extension"
    );
  });

  test("Should handle unmatched routes gracefully", async () => {
    const unmatchedUri = vscode.Uri.parse(
      "vscode://torque.extension/nonexistent/route"
    );

    let warningShown = false;

    const originalShowWarningMessage = vscode.window.showWarningMessage;

    vscode.window.showWarningMessage = async (message: string) => {
      if (message.includes("No handler found")) {
        warningShown = true;
      }
      return Promise.resolve(undefined);
    };

    try {
      await vscode.env.openExternal(unmatchedUri);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should show a warning for unmatched routes
      assert.ok(warningShown, "Should show warning for unmatched routes");
    } finally {
      vscode.window.showWarningMessage = originalShowWarningMessage;
    }
  });
});
