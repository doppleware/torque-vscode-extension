/**
 * MCP Server Manager
 *
 * Manages registration and lifecycle of the Torque MCP (Model Context Protocol) server.
 * Handles secure HTTP server definition with authentication headers and provider registration.
 *
 * Features:
 * - Creates MCP server definition with Torque API endpoint
 * - Configures authentication headers for secure communication
 * - Registers MCP server definition provider with VS Code
 * - Handles server health checks and registration cleanup
 *
 * @see {@link file://../../spec/mcp_auto_installation.md} MCP Auto Installation Specification
 */

import vscode from "vscode";

const MCP_SERVER_LABEL = "torque";
const MCP_SERVER_PROVIDER_ID = "torqueMcpProvider";

/**
 * Creates a secure MCP server URI with proper authentication headers
 */
const createMcpServerDefinition = (
  url: string,
  token: string
): vscode.McpHttpServerDefinition => {
  const mcpServerUrl = `${url}/api/torque_mcp`;

  // eslint-disable-next-line no-console
  console.log(
    `[Torque MCP] Creating server definition for URL: ${mcpServerUrl}`
  );

  const serverUri = vscode.Uri.parse(mcpServerUrl);
  const serverDef = new vscode.McpHttpServerDefinition(
    MCP_SERVER_LABEL,
    serverUri
  );

  // Try different approaches to set headers
  try {
    // Method 1: Try the headers property (might work in newer VS Code versions)

    (serverDef as unknown as Record<string, unknown>).headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
    // eslint-disable-next-line no-console
    console.log(`[Torque MCP] Set headers via headers property`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[Torque MCP] Failed to set headers:`, error);
  }

  // For debugging - log the final server definition
  // eslint-disable-next-line no-console
  console.log(`[Torque MCP] Final server definition:`, {
    label: serverDef.label,
    uri: serverDef.uri.toString(),
    hasHeaders: !!(serverDef as unknown as Record<string, unknown>).headers
  });

  return serverDef;
};

/**
 * Health check result interface
 */
interface McpHealthCheckResult {
  success: boolean;
  error?: string;
  responseTime?: number;
  statusCode?: number;
}

/**
 * Performs a health check on the MCP server endpoint
 */
const checkMcpServerHealth = async (
  url: string,
  token: string
): Promise<McpHealthCheckResult> => {
  const mcpServerUrl = `${url}/api/torque_mcp`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(mcpServerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "torque-vscode-extension",
            version: "1.0.0"
          }
        },
        id: 1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return { success: true, responseTime, statusCode: response.status };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
        statusCode: response.status
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request timeout (5s)", responseTime };
      }
      return { success: false, error: error.message, responseTime };
    }
    return { success: false, error: "Unknown error occurred", responseTime };
  }
};

/**
 * Validates URL and token inputs
 */
const validateInputs = (url: string, token: string): void => {
  if (!url || !token) {
    throw new Error("URL and token are required");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (token.length < 10) {
    throw new Error("Token appears to be too short");
  }
};

interface McpServerDisposable extends vscode.Disposable {
  triggerDiscovery(): void;
  checkHealth(): Promise<McpHealthCheckResult>;
}

/**
 * Registers MCP server with VS Code following best practices
 */
export const registerMcpServer = (
  url: string,
  token: string,
  showUserMessages = false
): McpServerDisposable => {
  // eslint-disable-next-line no-console
  console.log(`[Torque MCP] Starting MCP server registration with URL: ${url}`);

  try {
    validateInputs(url, token);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`[Torque MCP] Validation failed: ${errorMessage}`);
    throw new Error(`Invalid MCP server configuration: ${errorMessage}`);
  }

  // Perform initial health check
  void checkMcpServerHealth(url, token).then((healthResult) => {
    if (healthResult.success) {
      // eslint-disable-next-line no-console
      console.log(
        `[Torque MCP] Health check passed - server is reachable (${healthResult.responseTime}ms)`
      );
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[Torque MCP] Health check failed: ${healthResult.error} (${healthResult.responseTime}ms)`
      );

      if (showUserMessages) {
        vscode.window
          .showWarningMessage(
            "Torque connectivity parameters are incorrect, please run the configuration command.",
            "Configure Torque AI"
          )
          .then((result) => {
            if (result === "Configure Torque AI") {
              void vscode.commands.executeCommand("torque.setup");
            }
          });
      }
    }
  });

  const didChangeEmitter = new vscode.EventEmitter<void>();
  let currentServerDef: vscode.McpHttpServerDefinition | null = null;
  const mcpServerUrl = `${url}/api/torque_mcp`;

  // eslint-disable-next-line no-console
  console.log(
    `[Torque MCP] Registering MCP server definition provider with ID: ${MCP_SERVER_PROVIDER_ID}`
  );

  // Check if MCP API is available (might not be in test environments or older VS Code versions)
  if (
    !vscode.lm ||
    typeof vscode.lm.registerMcpServerDefinitionProvider !== "function"
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Torque MCP] MCP API not available in this VS Code version or environment`
    );
    return {
      dispose: () => {
        // No-op when MCP API is not available
      },
      triggerDiscovery: () => {
        // No-op when MCP API is not available
      },
      checkHealth: (): Promise<McpHealthCheckResult> => {
        return Promise.resolve({
          success: false,
          error: "MCP API not available"
        });
      }
    };
  }

  let provider: vscode.Disposable;
  try {
    provider = vscode.lm.registerMcpServerDefinitionProvider(
      MCP_SERVER_PROVIDER_ID,
      {
        onDidChangeMcpServerDefinitions: didChangeEmitter.event,

        provideMcpServerDefinitions: () => {
          // eslint-disable-next-line no-console
          console.log(
            `[Torque MCP] provideMcpServerDefinitions called - VS Code is requesting server definitions`
          );
          try {
            currentServerDef = createMcpServerDefinition(url, token);
            // eslint-disable-next-line no-console
            console.log(
              `[Torque MCP] Successfully created server definition: ${currentServerDef.label} at ${mcpServerUrl}`
            );
            // eslint-disable-next-line no-console
            console.log(
              `[Torque MCP] Server definition details:`,
              currentServerDef
            );
            return [currentServerDef];
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            // eslint-disable-next-line no-console
            console.error(
              `[Torque MCP] Failed to create server definition: ${errorMessage}`
            );
            vscode.window.showErrorMessage(
              `Failed to create MCP server definition: ${errorMessage}`
            );
            return [];
          }
        },

        resolveMcpServerDefinition: (server: vscode.McpServerDefinition) => {
          // eslint-disable-next-line no-console
          console.log(
            `[Torque MCP] Resolving server: ${server.label}, looking for: ${MCP_SERVER_LABEL}`
          );
          if (server.label === MCP_SERVER_LABEL && currentServerDef) {
            // eslint-disable-next-line no-console
            console.log(
              `[Torque MCP] Resolved server definition for: ${server.label}`
            );
            return currentServerDef;
          }
          // eslint-disable-next-line no-console
          console.log(`[Torque MCP] No matching server definition found`);
          return undefined;
        }
      }
    );

    // eslint-disable-next-line no-console
    console.log(
      `[Torque MCP] Provider registered successfully, triggering discovery...`
    );

    // Trigger initial discovery with more aggressive timing and logging
    setTimeout(() => {
      try {
        // eslint-disable-next-line no-console
        console.log(`[Torque MCP] Firing initial discovery event...`);
        didChangeEmitter.fire();

        // Trigger a second time to ensure registration
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log(`[Torque MCP] Firing second discovery event...`);
          didChangeEmitter.fire();
        }, 1000);

        // Trigger a third time with longer delay in case VS Code needs more time
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log(`[Torque MCP] Firing third discovery event...`);
          didChangeEmitter.fire();
        }, 3000);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(`[Torque MCP] Failed to trigger discovery:`, error);
        vscode.window.showErrorMessage(
          `Failed to trigger MCP server discovery: ${errorMessage}`
        );
      }
    }, 500);

    return {
      dispose: () => {
        currentServerDef = null;
        provider.dispose();
        didChangeEmitter.dispose();
      },
      triggerDiscovery: () => {
        didChangeEmitter.fire();
      },
      checkHealth: async () => {
        return await checkMcpServerHealth(url, token);
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`[Torque MCP] Failed to register MCP server:`, error);
    if (showUserMessages) {
      vscode.window.showErrorMessage(
        `Failed to register MCP server: ${errorMessage}`
      );
    }
    return {
      dispose: () => {
        // No-op when registration failed
      },
      triggerDiscovery: () => {
        // No-op when registration failed
      },
      checkHealth: (): Promise<McpHealthCheckResult> => {
        return Promise.resolve({
          success: false,
          error: errorMessage
        });
      }
    };
  }
};

/**
 * Updates MCP server configuration with new URL/token
 */
export const updateMcpServer = (
  disposable: McpServerDisposable | null,
  url: string,
  token: string,
  showUserMessages = false
): McpServerDisposable => {
  // Dispose existing registration
  if (disposable) {
    disposable.dispose();
  }

  // Create new registration with updated configuration
  return registerMcpServer(url, token, showUserMessages);
};
