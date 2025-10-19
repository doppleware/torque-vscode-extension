/**
 * Set Active Space Command
 *
 * Allows users to set the active Torque space for the current workspace.
 * If no active space is set, the default space will be used.
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import type { ApiClient } from "../../../api/ApiClient";
import type { SettingsManager } from "../SettingsManager";

/**
 * Registers the torque.setActiveSpace command
 *
 * @param settingsManager Settings manager instance
 * @param getApiClient Function to get the current API client
 * @returns Disposable for command registration
 */
export function registerSetActiveSpaceCommand(
  settingsManager: SettingsManager,
  getApiClient: () => ApiClient | null
): vscode.Disposable | undefined {
  try {
    const command = vscode.commands.registerCommand(
      "torque.setActiveSpace",
      async () => {
        try {
          // Get the API client
          const apiClient = getApiClient();
          if (!apiClient) {
            const configure = await vscode.window.showErrorMessage(
              "Torque AI is not configured. Please configure it first.",
              "Configure Now"
            );
            if (configure === "Configure Now") {
              await vscode.commands.executeCommand("torque.setup");
            }
            return;
          }

          // Fetch available spaces
          logger.info("Fetching spaces from API");
          const spaces = await apiClient.spaces.getSpaces();

          if (spaces.length === 0) {
            vscode.window.showWarningMessage(
              "No spaces found in your Torque account."
            );
            return;
          }

          // Get current active space and default space
          const currentActiveSpace =
            await settingsManager.getSetting<string>("activeSpace");
          const defaultSpace =
            await settingsManager.getSetting<string>("space");

          // Create quick pick items
          const spaceItems = spaces.map((space) => {
            const isActive = space.name === currentActiveSpace;
            const isDefault = space.name === defaultSpace;
            let label = space.name;
            let description = space.description ?? "";

            if (isActive && isDefault) {
              label = `$(check) ${label} (Active & Default)`;
            } else if (isActive) {
              label = `$(check) ${label} (Active)`;
            } else if (isDefault) {
              description = `${description ? description + " - " : ""}Default Space`;
            }

            return {
              label,
              description,
              spaceName: space.name
            };
          });

          // Add option to clear active space (use default)
          const clearOption = {
            label: "$(circle-slash) Use Default Space",
            description: defaultSpace
              ? `Clear active space and use default: ${defaultSpace}`
              : "Clear active space setting",
            spaceName: null as string | null
          };

          const allItems = [clearOption, ...spaceItems];

          // Show space selection
          const selected = await vscode.window.showQuickPick(allItems, {
            placeHolder: currentActiveSpace
              ? `Current active space: ${currentActiveSpace}`
              : defaultSpace
                ? `Using default space: ${defaultSpace}`
                : "Select active Torque space for this workspace",
            title: "Set Active Torque Space"
          });

          if (selected === undefined) {
            return; // User cancelled
          }

          // Update active space
          if (selected.spaceName === null) {
            // Clear active space
            await settingsManager.setSetting(
              "activeSpace",
              undefined,
              vscode.ConfigurationTarget.Workspace
            );
            const message = defaultSpace
              ? `Active space cleared. Using default space: ${defaultSpace}`
              : "Active space cleared.";
            vscode.window.showInformationMessage(message);
          } else {
            // Set new active space
            await settingsManager.setSetting(
              "activeSpace",
              selected.spaceName,
              vscode.ConfigurationTarget.Workspace
            );
            const isDefaultSpace = selected.spaceName === defaultSpace;
            const message = isDefaultSpace
              ? `Active space set to: ${selected.spaceName} (also your default space)`
              : `Active space set to: ${selected.spaceName}`;
            vscode.window.showInformationMessage(message);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to set active space", error as Error);
          vscode.window.showErrorMessage(
            `Failed to set active space: ${errorMessage}`
          );
        }
      }
    );
    logger.info("Registered torque.setActiveSpace command");
    return command;
  } catch {
    logger.warn("Command torque.setActiveSpace already registered, skipping");
    return undefined;
  }
}
