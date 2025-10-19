/**
 * Reset First-Time State Command
 *
 * For testing: resets the first-time activation state and clears configuration.
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import type { SettingsManager } from "../SettingsManager";

/**
 * Registers the torque.resetFirstTime command
 *
 * @param context Extension context
 * @param settingsManager Settings manager instance
 * @returns Disposable for command registration
 */
export function registerResetFirstTimeCommand(
  context: vscode.ExtensionContext,
  settingsManager: SettingsManager
): vscode.Disposable | undefined {
  try {
    const command = vscode.commands.registerCommand(
      "torque.resetFirstTime",
      async () => {
        // Reset first-time state
        await context.globalState.update("hasBeenActivatedBefore", false);

        // Clear configuration to test full onboarding flow
        await settingsManager.setSetting("url", "");
        await settingsManager.setSetting("token", "");

        logger.info(
          "Reset first-time state and cleared configuration - extension will show full onboarding on next activation"
        );
        vscode.window
          .showInformationMessage(
            "First-time state and configuration reset. Reload the window to test the full onboarding flow.",
            "Reload Window"
          )
          .then((result) => {
            if (result === "Reload Window") {
              vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          });
      }
    );
    logger.info("Registered torque.resetFirstTime command");
    return command;
  } catch {
    logger.warn("Command torque.resetFirstTime already registered, skipping");
    return undefined;
  }
}
