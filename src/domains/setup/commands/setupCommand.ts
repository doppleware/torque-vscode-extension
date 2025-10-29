/**
 * Setup Command
 *
 * Handles the initial configuration of Torque AI extension with URL, token, and default space.
 * Includes API health checks, MCP server registration, and credential validation.
 *
 * @see {@link file://../../spec/extension_configuration.md} Extension Configuration Specification
 * @see {@link file://../../spec/mcp_auto_installation.md} MCP Auto Installation Specification
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import { ApiClient } from "../../../api/ApiClient";
import type { SettingsManager } from "../SettingsManager";

type InitializeClientFn = (
  settingsManager: SettingsManager,
  showSuccessMessage?: boolean,
  showErrorMessages?: boolean,
  reinitialize?: boolean
) => Promise<void>;

/**
 * Registers the torque.setup command
 *
 * @param settingsManager Settings manager instance
 * @param initializeClient Callback to initialize the client after setup
 * @returns Disposable for command registration
 */
export function registerSetupCommand(
  settingsManager: SettingsManager,
  initializeClient: InitializeClientFn
): vscode.Disposable | undefined {
  try {
    const command = vscode.commands.registerCommand(
      "torque.setup",
      async () => {
        try {
          // Get URL
          const url = await vscode.window.showInputBox({
            prompt: "Enter your Torque API URL",
            placeHolder: "e.g., https://account.qtorque.io",
            validateInput: (value) => {
              if (!value) {
                return "URL is required";
              }
              try {
                new URL(value);
                return undefined;
              } catch {
                return "Please enter a valid URL";
              }
            }
          });

          if (!url) {
            return;
          }

          // Get token
          const token = await vscode.window.showInputBox({
            prompt: "Enter your Torque API token",
            password: true,
            placeHolder: "API token will be stored securely",
            validateInput: (value) => {
              if (!value) {
                return "Token is required";
              }
              if (value.length < 10) {
                return "Token seems too short";
              }
              return undefined;
            }
          });

          if (!token) {
            return;
          }

          // Fetch spaces using the provided credentials
          let selectedSpace: string | undefined;
          try {
            logger.info("Fetching spaces from API");
            const tempClient = new ApiClient(url, token);
            const spaces = await tempClient.spaces.getSpaces();

            if (spaces.length === 0) {
              vscode.window.showWarningMessage(
                "No spaces found in your account. Setup will continue without a default space."
              );
            } else {
              // Show space selection dropdown
              const spaceItems = spaces.map((space) => ({
                label: space.name,
                description: space.description
              }));

              const selected = await vscode.window.showQuickPick(spaceItems, {
                placeHolder: "Select your default Torque space",
                title: "Set Default Space"
              });

              if (selected) {
                selectedSpace = selected.label;
              }
            }
          } catch (error) {
            logger.error("Failed to fetch spaces", error as Error);
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            vscode.window.showWarningMessage(
              `Failed to fetch spaces: ${errorMessage}. Setup will continue without a default space.`
            );
          }

          // Store settings securely
          await settingsManager.setSetting("url", url);
          await settingsManager.setSetting("token", token);
          if (selectedSpace) {
            await settingsManager.setSetting("space", selectedSpace);
          }

          // Initialize client and register MCP server with success message and user error messages
          await initializeClient(settingsManager, true, true, true);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Setup failed: ${errorMessage}`);
        }
      }
    );
    logger.info("Registered torque.setup command");
    return command;
  } catch {
    logger.warn("Command torque.setup already registered, skipping");
    return undefined;
  }
}
