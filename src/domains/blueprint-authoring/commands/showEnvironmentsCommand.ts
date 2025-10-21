/**
 * Show Blueprint Environments Command
 *
 * Displays a list of active environments for a blueprint in a QuickPick menu
 * with "Add to chat" buttons for each environment
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import type { Environment } from "../../../api/services/types";
import { attachEnvironmentFileToChatContext } from "../../environment-context/handlers/environmentContextHandler";

interface EnvironmentQuickPickItem extends vscode.QuickPickItem {
  env: Environment;
}

/**
 * Register the show blueprint environments command
 */
export function registerShowBlueprintEnvironmentsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "torque.showBlueprintEnvironments",
    (blueprintName: string, environments: Environment[]) => {
      try {
        logger.info(
          `Showing ${environments.length} environments for blueprint: ${blueprintName}`
        );

        // Create QuickPick manually to support buttons
        const quickPick =
          vscode.window.createQuickPick<EnvironmentQuickPickItem>();
        quickPick.title = `Blueprint Environments (${environments.length})`;
        quickPick.placeholder = `Active environments for blueprint: ${blueprintName}`;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        // Create button for "Add to chat"
        const addToChatButton: vscode.QuickInputButton = {
          iconPath: new vscode.ThemeIcon("comment-discussion"),
          tooltip: "Add environment to chat context"
        };

        // Create QuickPick items with buttons
        quickPick.items = environments.map(
          (env): EnvironmentQuickPickItem => ({
            label: env.details.definition.metadata.name,
            description: `Owner: ${env.owner.display_first_name} ${env.owner.display_last_name}`,
            detail: `ID: ${env.id} | Space: ${env.details.definition.metadata.space_name}`,
            buttons: [addToChatButton],
            env
          })
        );

        // Handle button clicks
        quickPick.onDidTriggerItemButton((e) => {
          const item = e.item;
          const env = item.env;

          logger.info(
            `Add to chat clicked for environment: ${env.id} in space: ${env.details.definition.metadata.space_name}`
          );

          void (async () => {
            try {
              // Call the environment context handler
              // Note: This already shows a success notification, so we don't need another one
              await attachEnvironmentFileToChatContext(
                env.details.definition.metadata.space_name,
                env.id
              );
            } catch (error) {
              logger.error("Error adding environment to chat", error as Error);
              vscode.window.showErrorMessage(
                `Failed to add environment to chat: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          })();
        });

        // Handle item selection (optional - can be used to view details)
        quickPick.onDidAccept(() => {
          const selected = quickPick.selectedItems[0];
          if (selected) {
            const env = selected.env;
            logger.info(`Environment selected: ${env.id}`);
            // Could add additional actions here, like opening in browser
          }
        });

        // Handle QuickPick hide/dispose
        quickPick.onDidHide(() => {
          quickPick.dispose();
        });

        // Show the QuickPick
        quickPick.show();
      } catch (error) {
        logger.error("Error showing blueprint environments", error as Error);
        vscode.window.showErrorMessage(
          `Failed to show environments: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}
