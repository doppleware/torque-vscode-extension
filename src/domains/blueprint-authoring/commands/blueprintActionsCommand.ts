/**
 * Blueprint Actions Command
 *
 * Provides a QuickPick menu with actions for Torque blueprint files:
 * - Validate: Validate the blueprint
 * - Sync: Sync blueprint from SCM
 * - Deploy: Deploy the blueprint
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import type { ApiClient } from "../../../api/ApiClient";
import type { SettingsManager } from "../../setup/SettingsManager";
import {
  ValidateBlueprintAction,
  SyncBlueprintAction,
  DeployBlueprintAction
} from "./actions";

// Create a diagnostic collection for blueprint validation
const blueprintDiagnostics =
  vscode.languages.createDiagnosticCollection("torque-blueprint");

/**
 * Register the blueprint actions command
 */
export function registerBlueprintActionsCommand(
  settingsManager: SettingsManager,
  getApiClient: () => ApiClient | null,
  context: vscode.ExtensionContext
): vscode.Disposable {
  // Create action instances
  const validateAction = new ValidateBlueprintAction(
    settingsManager,
    getApiClient,
    blueprintDiagnostics
  );
  const syncAction = new SyncBlueprintAction(settingsManager, getApiClient);
  const deployAction = new DeployBlueprintAction(
    settingsManager,
    getApiClient,
    context
  );

  const commandDisposable = vscode.commands.registerCommand(
    "torque.blueprintActions",
    async (blueprintUri?: vscode.Uri) => {
      try {
        logger.info("Blueprint actions command invoked");

        // If no URI provided, try to get from active editor
        let uri = blueprintUri;
        if (!uri && vscode.window.activeTextEditor) {
          uri = vscode.window.activeTextEditor.document.uri;
        }

        if (!uri) {
          vscode.window.showErrorMessage(
            "No blueprint file found. Please open a blueprint file first."
          );
          return;
        }

        logger.info(`Blueprint URI: ${uri.fsPath}`);

        // Show QuickPick with available actions
        const action = await vscode.window.showQuickPick(
          [
            {
              label: "$(check) Validate",
              description: "Validate the blueprint syntax and structure",
              action: "validate"
            },
            {
              label: "$(sync) Sync from SCM",
              description: "Import the latest version from source control",
              action: "sync"
            },
            {
              label: "$(rocket) Deploy",
              description: "Deploy the blueprint to Torque",
              action: "deploy"
            }
          ],
          {
            placeHolder: "Select an action for this blueprint",
            title: "Blueprint Actions"
          }
        );

        if (!action) {
          logger.info("User cancelled action selection");
          return;
        }

        logger.info(`User selected action: ${action.action}`);

        // Execute the selected action using action classes
        switch (action.action) {
          case "validate":
            await validateAction.execute(uri);
            break;
          case "sync":
            await syncAction.execute(uri);
            break;
          case "deploy":
            await deployAction.execute(uri);
            break;
          default:
            logger.warn(`Unknown action: ${action.action}`);
        }
      } catch (error) {
        logger.error("Error in blueprint actions command", error as Error);
        vscode.window.showErrorMessage(
          `Blueprint action failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Return a composite disposable that includes both the command and the diagnostic collection
  return vscode.Disposable.from(commandDisposable, blueprintDiagnostics);
}
