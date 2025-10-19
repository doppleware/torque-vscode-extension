/**
 * Set Default Space Command
 *
 * Allows users to set the global default Torque space.
 * This is the space used across all workspaces unless overridden by an active space.
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import type { ApiClient } from "../../../api/ApiClient";
import type { SettingsManager } from "../SettingsManager";

/**
 * Registers the torque.setDefaultSpace command
 *
 * @param settingsManager Settings manager instance
 * @param getApiClient Function to get the current API client
 * @returns Disposable for command registration
 */
export function registerSetDefaultSpaceCommand(
  settingsManager: SettingsManager,
  getApiClient: () => ApiClient | null
): vscode.Disposable | undefined {
  try {
    const command = vscode.commands.registerCommand(
      "torque.setDefaultSpace",
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

          // Get current default space
          const currentDefaultSpace =
            await settingsManager.getSetting<string>("space");

          // Create quick pick items
          const spaceItems = spaces.map((space) => {
            const isDefault = space.name === currentDefaultSpace;
            let label = space.name;
            const description = space.description ?? "";

            if (isDefault) {
              label = `$(check) ${label} (Current Default)`;
            }

            return {
              label,
              description,
              spaceName: space.name
            };
          });

          // Show space selection
          const selected = await vscode.window.showQuickPick(spaceItems, {
            placeHolder: currentDefaultSpace
              ? `Current default space: ${currentDefaultSpace}`
              : "Select default Torque space (used across all workspaces)",
            title: "Set Default Torque Space"
          });

          if (selected === undefined) {
            return; // User cancelled
          }

          // Update default space (stored globally)
          await settingsManager.setSetting(
            "space",
            selected.spaceName,
            vscode.ConfigurationTarget.Global
          );

          vscode.window.showInformationMessage(
            `Default space set to: ${selected.spaceName}`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to set default space", error as Error);
          vscode.window.showErrorMessage(
            `Failed to set default space: ${errorMessage}`
          );
        }
      }
    );
    logger.info("Registered torque.setDefaultSpace command");
    return command;
  } catch {
    logger.warn("Command torque.setDefaultSpace already registered, skipping");
    return undefined;
  }
}
