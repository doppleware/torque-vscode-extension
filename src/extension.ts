import express from "express";
import net from "net";
import vscode from "vscode";
import { ApiClient } from "./api/ApiClient";
import { updateMcpServer } from "./domains/mcp";
import {
  SettingsManager,
  isExtensionConfigured,
  showSetupNotificationIfNeeded,
  registerSetupCommand,
  registerSetActiveSpaceCommand,
  registerSetDefaultSpaceCommand,
  registerResetFirstTimeCommand
} from "./domains/setup";
import { handleEnvironmentContextUrl } from "./domains/environment-context";
import { openWebviewWithUrl } from "./uris/handlers/webview";
import { UriRouter } from "./uris/UriRouter";
import { logger } from "./utils/Logger";
import {
  registerCreateBlueprintCommand,
  registerBlueprintActionsCommand,
  registerShowBlueprintEnvironmentsCommand,
  registerAddGrainScriptCommand,
  BlueprintCodeLensProvider,
  GrainScriptCodeLensProvider,
  registerGrainCompletionProvider
} from "./domains/blueprint-authoring";

const START_PORT = 33100;
const END_PORT = 33199;

let apiClient: ApiClient | null = null;
interface McpHealthResult {
  success: boolean;
  error?: string;
  responseTime?: number;
  statusCode?: number;
}

let mcpServerDisposable: {
  dispose(): void;
  triggerDiscovery(): void;
  checkHealth(): Promise<McpHealthResult>;
} | null = null;
let isActivated = false;

const getBaseDomain = (url: string): string => {
  const hostname = new URL(url).hostname;
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
};

const findAvailablePort = async (
  start: number,
  end: number
): Promise<number> => {
  logger.debug(`Searching for available port in range ${start}-${end}`);
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) {
      logger.info(`Found available port: ${port}`);
      return port;
    }
  }
  const error = new Error(`No available ports in range ${start}-${end}`);
  logger.error("Failed to find available port", error);
  throw error;
};

const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
};

async function initializeClient(
  settingsManager: SettingsManager,
  showSuccessMessage = false,
  showErrorMessages = false,
  reinitialize = false
): Promise<void> {
  logger.info(
    `initializeClient called with showSuccessMessage=${showSuccessMessage}, showErrorMessages=${showErrorMessages}, reinitialize=${reinitialize}`
  );

  const url = await settingsManager.getSetting<string>("url");
  const token = await settingsManager.getSetting<string>("token");

  logger.info(
    `Got settings: url=${url ? "present" : "missing"}, token=${token ? "present" : "missing"}`
  );

  if (!token || !url) {
    logger.debug("Client initialization skipped - missing URL or token");
    return;
  }

  logger.info(`Initializing API client with URL: ${url}`);

  // Reinitialize if requested or if client doesn't exist
  if (reinitialize || !apiClient) {
    // Initialize the client
    apiClient = new ApiClient(url, token);
  }

  // Always register MCP server when both URL and token are available
  const shouldRegisterMcp = true;
  if (shouldRegisterMcp) {
    try {
      logger.info("Registering MCP server");
      // Update MCP server registration with new configuration
      mcpServerDisposable = updateMcpServer(
        mcpServerDisposable,
        url,
        token,
        showErrorMessages
      );

      // Enable required VS Code settings
      await enableRequiredSettings();

      if (showSuccessMessage) {
        await showMcpSetupSuccessMessage();
      }
      logger.info("MCP server registration completed successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to register MCP server", error as Error);
      vscode.window.showErrorMessage(
        `Failed to register MCP server: ${errorMessage}`
      );
      // Don't throw - allow setup to complete even if MCP fails
    }
  }
}

/**
 * Enables required VS Code settings for MCP functionality
 */
const enableRequiredSettings = async (): Promise<void> => {
  try {
    logger.debug("Enabling required VS Code settings for MCP");
    const config = vscode.workspace.getConfiguration();

    // Enable chat agent if available
    const agentEnabled = config.get("chat.agent.enabled");
    if (!agentEnabled) {
      try {
        logger.info("Enabling chat.agent.enabled setting");
        await config.update(
          "chat.agent.enabled",
          true,
          vscode.ConfigurationTarget.Global
        );
      } catch {
        logger.debug(
          "chat.agent.enabled setting not available in this VS Code version"
        );
      }
    }

    // Enable MCP if available (this setting may not exist in all VS Code versions)
    const mcpEnabled = config.get("chat.mcp.enabled");
    if (!mcpEnabled) {
      try {
        logger.info("Enabling chat.mcp.enabled setting");
        await config.update(
          "chat.mcp.enabled",
          true,
          vscode.ConfigurationTarget.Global
        );
      } catch {
        logger.debug(
          "chat.mcp.enabled setting not available in this VS Code version"
        );
      }
    }
    logger.debug("Required settings check completed");
  } catch (error) {
    logger.warn("Failed to update some VS Code settings", {
      error: error instanceof Error ? error.message : String(error)
    });
    // Settings update is not critical, silently continue
  }
};

/**
 * Installs GitHub Copilot instruction file and enables setting
 *
 * Automatically installs/updates .github/copilot-instructions.md from the bundled template
 * to provide AI assistants with Torque-specific tool usage guidance.
 * This will overwrite any existing file to ensure users have the latest Torque instructions.
 *
 * @see {@link file://../spec/agent_instructions.md} Agent Instructions Specification
 */
const registerAgentInstructions = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  try {
    logger.debug("Setting up Torque AI agent instructions");

    // Enable the GitHub Copilot instruction files setting
    const config = vscode.workspace.getConfiguration(
      "github.copilot.chat.codeGeneration"
    );
    const useInstructionFiles = config.get<boolean>("useInstructionFiles");

    if (!useInstructionFiles) {
      await config.update(
        "useInstructionFiles",
        true,
        vscode.ConfigurationTarget.Workspace
      );
      logger.info("Enabled GitHub Copilot instruction files setting");
    }

    // Ensure .github directory and copilot-instructions.md exist
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.warn("No workspace folder found, skipping instruction file setup");
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri;
    const githubDir = vscode.Uri.joinPath(workspaceRoot, ".github");
    const instructionFile = vscode.Uri.joinPath(
      githubDir,
      "copilot-instructions.md"
    );

    // Always install/update the Torque instruction file
    logger.info("Installing/updating GitHub Copilot instruction file");

    // Ensure .github directory exists
    try {
      await vscode.workspace.fs.createDirectory(githubDir);
    } catch {
      // Directory might already exist, ignore error
    }

    // Read the Torque instruction template from the extension directory
    const extensionPath = context.extensionUri;
    const templateFile = vscode.Uri.joinPath(
      extensionPath,
      "docs",
      "torque_dev_instruction.md"
    );

    try {
      const content = await vscode.workspace.fs.readFile(templateFile);
      await vscode.workspace.fs.writeFile(instructionFile, content);
      logger.info(
        "Successfully installed GitHub Copilot instruction file from Torque template"
      );
    } catch (error) {
      logger.warn(
        "Could not copy Torque instruction template to Copilot instruction file",
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }

    logger.debug("Agent instructions setup completed");
  } catch (error) {
    logger.warn("Failed to set up agent instructions", {
      error: error instanceof Error ? error.message : String(error)
    });
    // Instruction setup is not critical, silently continue
  }
};

/**
 * Shows success message and guides user to next steps
 */
const showMcpSetupSuccessMessage = async (): Promise<void> => {
  const result = await vscode.window.showInformationMessage(
    "✅ Torque AI configured successfully!\n\n" +
      "🔧 MCP server registered and ready to use.\n" +
      "📱 Open Copilot Chat to access Torque AI tools.",
    "Open Chat",
    "Check Status"
  );

  if (result === "Open Chat") {
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open");
    } catch {
      vscode.window.showInformationMessage(
        "Could not open chat automatically. Please open Copilot Chat manually and look for Torque tools."
      );
    }
  } else if (result === "Check Status") {
    await vscode.commands.executeCommand("torque.checkMcpStatus");
  }
};

export async function activate(context: vscode.ExtensionContext) {
  if (isActivated) {
    logger.warn("Extension already activated, skipping duplicate activation");
    return;
  }
  isActivated = true;
  logger.info("Torque AI extension activating");

  const uriRouter = new UriRouter();

  const settingsManager = new SettingsManager(context);

  // Initialize client and MCP server if configured
  // (showSuccessMessage=false during activation)
  await initializeClient(settingsManager, false);

  // Register agent instructions for VS Code Copilot
  await registerAgentInstructions(context);

  // Show setup notification if not configured (with delay to avoid startup noise)
  setTimeout(() => {
    void showSetupNotificationIfNeeded(settingsManager, context);
  }, 2000);

  // Register Language Model Tools
  // The tools are declared in package.json but must be registered with handlers
  if (vscode.lm && typeof vscode.lm.registerTool === "function") {
    try {
      // Register environment details tool
      const { TorqueEnvironmentDetailsTool } = await import(
        "./domains/environment-context/tools/TorqueEnvironmentDetailsTool"
      );
      const environmentTool = vscode.lm.registerTool(
        "torque_get_environment_details",
        new TorqueEnvironmentDetailsTool()
      );
      context.subscriptions.push(environmentTool);
      logger.info(
        "✅ Successfully registered torque_get_environment_details Language Model Tool"
      );

      // Register current space tool
      const { TorqueCurrentSpaceTool } = await import(
        "./domains/setup/tools/TorqueCurrentSpaceTool"
      );
      const currentSpaceTool = vscode.lm.registerTool(
        "get_current_torque_space",
        new TorqueCurrentSpaceTool(settingsManager)
      );
      context.subscriptions.push(currentSpaceTool);
      logger.info(
        "✅ Successfully registered get_current_torque_space Language Model Tool"
      );
    } catch (error) {
      logger.error(
        "Failed to register Language Model Tools",
        error instanceof Error ? error : new Error(String(error))
      );
      vscode.window.showWarningMessage(
        "Failed to register Torque tools. Some AI features may not work."
      );
    }
  } else {
    logger.warn(
      "Language Model Tool API not available in this VS Code version. Please ensure you're using VS Code 1.101 or later with GitHub Copilot installed."
    );
  }

  uriRouter.route(
    "/chat/context/add/environment/:space_name/:environment_id",
    async (params) => {
      logger.info(
        `Handling environment context for space: ${params.space_name}, environment: ${params.environment_id}`
      );
      await handleEnvironmentContextUrl({
        space_name: params.space_name,
        environment_id: params.environment_id
      });
    }
  );

  uriRouter.route("/webview/open", async (_, query) => {
    const url = query?.url;
    logger.info(`Webview open request for URL: ${url}`);

    const settingsUrl = await settingsManager.getSetting<string>("url");
    if (settingsUrl && url) {
      const settingsBaseDomain = getBaseDomain(settingsUrl);
      const urlBaseDomain = getBaseDomain(url);

      if (settingsBaseDomain === urlBaseDomain) {
        logger.info(`Opening webview for allowed domain: ${urlBaseDomain}`);
        openWebviewWithUrl(url);
      } else {
        logger.warn(
          `Webview blocked - domain mismatch. Settings: ${settingsBaseDomain}, Requested: ${urlBaseDomain}`
        );
        vscode.window.showErrorMessage(
          "URL must be from the same base domain as configured"
        );
      }
    } else {
      logger.warn(
        "Webview open failed - missing URL parameter or settings URL"
      );
      vscode.window.showErrorMessage("URL parameter is required for webview");
    }
  });

  // Register Blueprint CodeLens Provider
  const blueprintCodeLensProvider = new BlueprintCodeLensProvider(
    settingsManager,
    () => apiClient
  );
  // Support both local files and remote repos (GitHub, vscode-vfs, etc.)
  const codeLensDisposable = vscode.Disposable.from(
    vscode.languages.registerCodeLensProvider(
      { language: "yaml", scheme: "file" },
      blueprintCodeLensProvider
    ),
    vscode.languages.registerCodeLensProvider(
      { language: "yaml", scheme: "vscode-vfs" },
      blueprintCodeLensProvider
    ),
    vscode.languages.registerCodeLensProvider(
      { language: "yaml", scheme: "untitled" },
      blueprintCodeLensProvider
    )
  );

  // Register Grain Script CodeLens Provider
  const grainScriptCodeLensProvider = new GrainScriptCodeLensProvider();
  const grainScriptCodeLensDisposable = vscode.Disposable.from(
    vscode.languages.registerCodeLensProvider(
      { language: "yaml", scheme: "file" },
      grainScriptCodeLensProvider
    ),
    vscode.languages.registerCodeLensProvider(
      { language: "yaml", scheme: "vscode-vfs" },
      grainScriptCodeLensProvider
    ),
    vscode.languages.registerCodeLensProvider(
      { language: "yaml", scheme: "untitled" },
      grainScriptCodeLensProvider
    )
  );

  // Register Grain Completion Provider
  const grainCompletion = registerGrainCompletionProvider(
    settingsManager,
    () => apiClient
  );

  // Since URL and token are now stored as secrets, configuration changes are not relevant
  // The configuration listener is kept for potential future settings
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(
    (e) => {
      // Refresh CodeLens when active space or default space changes
      if (
        e.affectsConfiguration("torque-ai.activeSpace") ||
        e.affectsConfiguration("torque-ai.space")
      ) {
        blueprintCodeLensProvider.refresh();
      }
    }
  );

  // Register MCP discovery trigger command
  let triggerMcpDiscoveryCommand: vscode.Disposable | undefined;
  try {
    triggerMcpDiscoveryCommand = vscode.commands.registerCommand(
      "torque.triggerMcpDiscovery",
      () => {
        if (mcpServerDisposable) {
          mcpServerDisposable.triggerDiscovery();
          vscode.window.showInformationMessage(
            "MCP server discovery triggered."
          );
        } else {
          vscode.window.showWarningMessage(
            "No MCP server registered. Run 'Setup Torque AI' command first."
          );
        }
      }
    );
  } catch {
    logger.warn(
      "Command torque.triggerMcpDiscovery already registered, skipping"
    );
  }

  // Register MCP health check command
  let checkMcpHealthCommand: vscode.Disposable | undefined;
  try {
    checkMcpHealthCommand = vscode.commands.registerCommand(
      "torque.checkMcpHealth",
      async () => {
        if (!mcpServerDisposable) {
          vscode.window.showWarningMessage(
            "No MCP server registered. Run 'Setup Torque AI' command first."
          );
          return;
        }

        await vscode.window.showInformationMessage(
          "Checking MCP server health...",
          { modal: false }
        );

        try {
          const healthResult: McpHealthResult =
            await mcpServerDisposable.checkHealth();

          if (healthResult.success) {
            vscode.window.showInformationMessage(
              `✅ MCP Server Health Check Passed\n` +
                `Response time: ${healthResult.responseTime}ms\n` +
                `Status: ${healthResult.statusCode}`
            );
          } else {
            vscode.window.showErrorMessage(
              `❌ MCP Server Health Check Failed\n` +
                `Error: ${healthResult.error}\n` +
                `Response time: ${healthResult.responseTime}ms\n` +
                `Status: ${healthResult.statusCode ?? "N/A"}`
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Health check failed: ${errorMessage}`
          );
        }
      }
    );
  } catch {
    logger.warn("Command torque.checkMcpHealth already registered, skipping");
  }

  // Register MCP status check command
  let checkMcpStatusCommand: vscode.Disposable | undefined;
  try {
    checkMcpStatusCommand = vscode.commands.registerCommand(
      "torque.checkMcpStatus",
      async () => {
        const isConfigured = await isExtensionConfigured(settingsManager);
        const status = mcpServerDisposable
          ? "✅ Registered"
          : "❌ Not registered";
        let healthStatus = "⏳ Unknown";

        // Check health if server is registered
        if (mcpServerDisposable) {
          try {
            const healthResult: McpHealthResult =
              await mcpServerDisposable.checkHealth();
            healthStatus = healthResult.success
              ? `✅ Healthy (${healthResult.responseTime}ms)`
              : `❌ Unhealthy: ${healthResult.error}`;
          } catch (error) {
            healthStatus = `❌ Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
        }

        const configStatus = isConfigured
          ? "✅ Configured"
          : "❌ Not configured";

        // Check if GitHub Copilot is installed
        const copilotExtension =
          vscode.extensions.getExtension("GitHub.copilot");
        const copilotStatus = copilotExtension
          ? copilotExtension.isActive
            ? "✅ Active"
            : "⚠️ Inactive"
          : "❌ Not installed";

        // Check MCP API availability
        const mcpApiStatus =
          typeof vscode.lm?.registerMcpServerDefinitionProvider === "function"
            ? "✅ Available"
            : "❌ Not available";

        // Check VS Code version
        const vscodeVersion = vscode.version;

        // Check MCP settings
        const config = vscode.workspace.getConfiguration();
        const mcpEnabled = config.get("chat.mcp.enabled");
        const agentEnabled = config.get("chat.agent.enabled");

        // Get all available commands to check for MCP commands
        const allCommands = await vscode.commands.getCommands();
        const mcpCommands = allCommands
          .filter((cmd) => cmd.includes("mcp"))
          .slice(0, 5); // Show first 5

        if (!isConfigured) {
          const result = await vscode.window.showWarningMessage(
            `📊 Torque AI Status:\n` +
              `Configuration: ${configStatus}\n` +
              `MCP Server: ${status}\n` +
              `Server Health: ${healthStatus}\n` +
              `GitHub Copilot: ${copilotStatus}\n` +
              `MCP API: ${mcpApiStatus}\n` +
              `VS Code Version: ${vscodeVersion}\n` +
              `MCP Enabled: ${mcpEnabled ? "✅ Yes" : "❌ No"}\n` +
              `Agent Enabled: ${agentEnabled ? "✅ Yes" : "❌ No"}\n` +
              `MCP Commands Available: ${mcpCommands.length}\n\n` +
              "⚠️  Extension needs configuration before MCP server can be registered.",
            "Configure Now"
          );

          if (result === "Configure Now") {
            await vscode.commands.executeCommand("torque.setup");
          }
          return;
        }

        try {
          // Try to execute the built-in MCP command to list servers
          await vscode.commands.executeCommand("mcp.showInstalledServers");

          vscode.window.showInformationMessage(
            `📊 Torque AI Status:\n` +
              `Configuration: ${configStatus}\n` +
              `MCP Server: ${status}\n` +
              `Server Health: ${healthStatus}\n` +
              `GitHub Copilot: ${copilotStatus}\n` +
              `MCP API: ${mcpApiStatus}\n` +
              `VS Code Version: ${vscodeVersion}\n` +
              `MCP Enabled: ${mcpEnabled ? "✅ Yes" : "❌ No"}\n` +
              `Agent Enabled: ${agentEnabled ? "✅ Yes" : "❌ No"}\n` +
              `MCP Commands: ${mcpCommands.join(", ") || "None"}\n\n` +
              "🔍 Debugging Info:\n" +
              "- Health check shows actual server connectivity\n" +
              "- Use 'Torque: Check MCP Health' for detailed diagnostics\n" +
              "- Check browser console (Help > Toggle Developer Tools) for '[Torque MCP]' logs\n" +
              "- Try 'Torque: Refresh MCP Connection' command\n\n" +
              "💡 Next steps:\n" +
              "1. Check the MCP Servers panel that opened\n" +
              "2. Open Copilot Chat (⌃⌘I or Ctrl+Alt+I)\n" +
              "3. Click the Tools button and enable 'torque' server\n" +
              "4. Ask: '@agent use torque tools to analyze my code'"
          );
        } catch {
          vscode.window.showInformationMessage(
            `📊 Torque AI Status:\n` +
              `Configuration: ${configStatus}\n` +
              `MCP Server: ${status}\n` +
              `Server Health: ${healthStatus}\n` +
              `GitHub Copilot: ${copilotStatus}\n` +
              `MCP API: ${mcpApiStatus}\n` +
              `VS Code Version: ${vscodeVersion}\n` +
              `MCP Enabled: ${mcpEnabled ? "✅ Yes" : "❌ No"}\n` +
              `Agent Enabled: ${agentEnabled ? "✅ Yes" : "❌ No"}\n` +
              `MCP Commands: ${mcpCommands.join(", ") || "None"}\n\n` +
              "📋 Requirements:\n" +
              "1. Install GitHub Copilot extension\n" +
              "2. Enable Agent Mode in Copilot Chat\n" +
              "3. Look for Torque tools in the chat interface\n" +
              "4. Use 'Torque: Check MCP Health' to verify connectivity"
          );
        }
      }
    );
  } catch {
    logger.warn("Command torque.checkMcpStatus already registered, skipping");
  }

  // Register recreate MCP server command
  let recreateMcpServerCommand: vscode.Disposable | undefined;
  try {
    recreateMcpServerCommand = vscode.commands.registerCommand(
      "torque.recreateMcpServer",
      async () => {
        const isConfigured = await isExtensionConfigured(settingsManager);
        if (!isConfigured) {
          const result = await vscode.window.showWarningMessage(
            "Extension is not configured. Please configure Torque AI first.",
            "Configure Now"
          );
          if (result === "Configure Now") {
            await vscode.commands.executeCommand("torque.setup");
          }
          return;
        }

        const result = await vscode.window.showInformationMessage(
          "This will recreate the MCP server registration. Continue?",
          "Yes",
          "No"
        );

        if (result !== "Yes") {
          return;
        }

        try {
          logger.info("Recreating MCP server configuration");

          // Show progress while recreating
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Recreating MCP server...",
              cancellable: false
            },
            async (progress) => {
              progress.report({ increment: 0 });

              // Reinitialize the client and MCP server without success message
              // (success message shown after progress closes)
              await initializeClient(settingsManager, false, true, true);

              progress.report({ increment: 100 });
            }
          );

          // Show success message after progress notification closes
          await showMcpSetupSuccessMessage();

          logger.info("MCP server recreated successfully");
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to recreate MCP server", error as Error);
          vscode.window.showErrorMessage(
            `Failed to recreate MCP server: ${errorMessage}`
          );
        }
      }
    );
  } catch {
    logger.warn(
      "Command torque.recreateMcpServer already registered, skipping"
    );
  }

  // Register unified setup command
  // Register setup command
  const setupCommand = registerSetupCommand(settingsManager, initializeClient);

  // Register set active space command
  const setActiveSpaceCommand = registerSetActiveSpaceCommand(
    settingsManager,
    () => apiClient
  );

  // Register set default space command
  const setDefaultSpaceCommand = registerSetDefaultSpaceCommand(
    settingsManager,
    () => apiClient
  );

  // Register test URI command for debugging
  let testUriCommand: vscode.Disposable | undefined;
  try {
    testUriCommand = vscode.commands.registerCommand(
      "torque.testUri",
      async () => {
        const testUri =
          "vscode://quali.torque-ai/chat/context/add/environment/test-space/test-env";
        try {
          await vscode.env.openExternal(vscode.Uri.parse(testUri));
          vscode.window.showInformationMessage(
            `Triggered test URI: ${testUri}`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to trigger test URI: ${errorMessage}`
          );
        }
      }
    );
  } catch {
    logger.warn("Command torque.testUri already registered, skipping");
  }

  // Register reset first-time state command for testing
  const resetFirstTimeCommand = registerResetFirstTimeCommand(
    context,
    settingsManager
  );

  // Register create Torque Blueprint command
  const createBlueprintCommand = registerCreateBlueprintCommand();

  // Register blueprint actions command
  const blueprintActionsCommand = registerBlueprintActionsCommand(
    settingsManager,
    () => apiClient,
    context
  );

  // Register show blueprint environments command
  const showBlueprintEnvironmentsCommand =
    registerShowBlueprintEnvironmentsCommand();

  // Register add grain script command
  const addGrainScriptCommand = registerAddGrainScriptCommand();

  context.subscriptions.push(configChangeListener);
  if (setupCommand) {
    context.subscriptions.push(setupCommand);
  }
  if (setActiveSpaceCommand) {
    context.subscriptions.push(setActiveSpaceCommand);
  }
  if (setDefaultSpaceCommand) {
    context.subscriptions.push(setDefaultSpaceCommand);
  }
  if (triggerMcpDiscoveryCommand) {
    context.subscriptions.push(triggerMcpDiscoveryCommand);
  }
  if (checkMcpHealthCommand) {
    context.subscriptions.push(checkMcpHealthCommand);
  }
  if (checkMcpStatusCommand) {
    context.subscriptions.push(checkMcpStatusCommand);
  }
  if (recreateMcpServerCommand) {
    context.subscriptions.push(recreateMcpServerCommand);
  }
  if (testUriCommand) {
    context.subscriptions.push(testUriCommand);
  }
  if (resetFirstTimeCommand) {
    context.subscriptions.push(resetFirstTimeCommand);
  }
  if (createBlueprintCommand) {
    context.subscriptions.push(createBlueprintCommand);
  }
  if (blueprintActionsCommand) {
    context.subscriptions.push(blueprintActionsCommand);
  }
  if (showBlueprintEnvironmentsCommand) {
    context.subscriptions.push(showBlueprintEnvironmentsCommand);
  }
  if (addGrainScriptCommand) {
    context.subscriptions.push(addGrainScriptCommand);
  }
  context.subscriptions.push(codeLensDisposable);
  context.subscriptions.push(grainScriptCodeLensDisposable);
  context.subscriptions.push(grainCompletion.disposable);

  const uriHandler = vscode.window.registerUriHandler({
    handleUri: async (uri) => {
      logger.info(`[URI Handler] Received URI: ${uri.toString()}`);
      logger.info(
        `[URI Handler] URI scheme: ${uri.scheme}, authority: ${uri.authority}, path: ${uri.path}, query: ${uri.query}`
      );

      try {
        const handled = await uriRouter.handleUri(uri);
        if (!handled) {
          logger.warn(
            `[URI Handler] No route found for URI: ${uri.toString()}`
          );
          vscode.window.showWarningMessage(
            `No handler found for URL: ${uri.toString()}`
          );
        } else {
          logger.info(
            `[URI Handler] Successfully handled URI: ${uri.toString()}`
          );
          // Success notification is handled by individual route handlers
        }
      } catch (error) {
        logger.error(
          `[URI Handler] Failed to handle URI: ${uri.toString()}`,
          error as Error
        );
        vscode.window.showErrorMessage(
          `Failed to handle URL: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  });

  logger.info(`[Extension] URI handler registered successfully`);

  context.subscriptions.push(uriHandler);

  const app = express();
  app.use(express.json());

  const port = await findAvailablePort(START_PORT, END_PORT);

  app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    next();
  });

  app.get("/api/torque/about", (_, res) => {
    res.json({
      ideName: vscode.env.appName,
      ideUriScheme: vscode.env.uriScheme,
      ideVersion: vscode.version,
      workspace: vscode.workspace.name
    });
  });

  const server = app.listen(port, () => {
    logger.info(`Express server started on port ${port}`);
  });

  context.subscriptions.push({
    dispose: () => {
      logger.info("Extension deactivating - cleaning up resources");
      server.close();
      apiClient = null;
      if (mcpServerDisposable) {
        mcpServerDisposable.dispose();
        mcpServerDisposable = null;
      }
    }
  });

  logger.info("Torque AI extension activation completed successfully");

  // Return API for testing
  return {
    resetApiClientForTesting
  };
}

export function deactivate() {
  logger.info("Torque AI extension deactivating");
  if (apiClient) {
    apiClient = null;
  }

  if (mcpServerDisposable) {
    mcpServerDisposable.dispose();
    mcpServerDisposable = null;
  }
  isActivated = false;
  logger.dispose();
}

/**
 * Reset the API client - for testing purposes only
 * This is needed in tests where credentials are cleared but the module-level
 * apiClient variable remains cached
 */
export function resetApiClientForTesting() {
  apiClient = null;
}

export function getClient(): ApiClient {
  if (!apiClient) {
    throw new Error("ApiClient not initialized");
  }
  return apiClient;
}
