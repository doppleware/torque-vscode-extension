/**
 * Sync Blueprint Action
 */

import * as vscode from "vscode";
import { logger } from "../../../../utils/Logger";
import { BaseBlueprintAction } from "./BaseBlueprintAction";

export class SyncBlueprintAction extends BaseBlueprintAction {
  async execute(uri: vscode.Uri): Promise<void> {
    logger.info(`Syncing blueprint: ${uri.fsPath}`);

    try {
      const maybeClient = await this.getClientOrShowError();
      if (!maybeClient) {
        return;
      }
      const client = maybeClient;

      const spaceName = await this.getSpaceNameOrShowError();
      if (!spaceName) {
        return;
      }

      const blueprintName = this.getBlueprintName(uri);

      // For now, we'll use "torque_iac" as the repository name
      // TODO: This could be made configurable or detected from the workspace
      const repositoryName = "torque_iac";

      logger.info(
        `Syncing blueprint "${blueprintName}" from repository "${repositoryName}" in space "${spaceName}"`
      );

      // Log the sync request for debugging
      logger.info("=== Sync Request Details ===");
      logger.info(`Space: ${spaceName}`);
      logger.info(`Repository: ${repositoryName}`);
      logger.info(`Blueprint Name: ${blueprintName}`);
      logger.info(`File Path: ${uri.fsPath}`);
      logger.info("============================");

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Syncing blueprint "${blueprintName}" from SCM...`,
          cancellable: false
        },
        async () => {
          await client.spaces.syncBlueprintFromScm(
            spaceName,
            repositoryName,
            blueprintName
          );

          logger.info("=== Sync Successful ===");
          logger.info(`Blueprint "${blueprintName}" synced successfully`);
          logger.info("=======================");

          vscode.window.showInformationMessage(
            `✓ Blueprint "${blueprintName}" synced successfully from SCM!`
          );
        }
      );
    } catch (error) {
      logger.error("Error syncing blueprint from SCM", error as Error);
      vscode.window.showErrorMessage(
        `Failed to sync blueprint from SCM: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
