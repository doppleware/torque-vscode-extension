/**
 * Set Active Space Command
 *
 * Allows users to set the active Torque space for the current workspace.
 * If no active space is set, the default space will be used.
 * Fetches available spaces from API and shows QuickPick for selection.
 *
 * @see {@link file://../../spec/torque_space_selection.md} Torque Space Selection Specification
 * @see {@link file://../../spec/extension_configuration.md} Extension Configuration Specification
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import { getGitRemoteUrl, isSameRepository } from "../../../utils/git";
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
          const allSpaces = await apiClient.spaces.getSpaces();

          if (allSpaces.length === 0) {
            vscode.window.showWarningMessage(
              "No spaces found in your Torque account."
            );
            return;
          }

          // Get current Git repository URL and check which spaces contain it
          const currentRepoUrl = await getGitRemoteUrl();
          const spaceHasRepo = new Map<string, boolean>();

          // Check which spaces contain the current repository
          if (currentRepoUrl) {
            logger.info(`Current repository URL: ${currentRepoUrl}`);
            logger.info(`Checking ${allSpaces.length} spaces for repository`);

            const repoCheckResults = await Promise.all(
              allSpaces.map(async (space) => {
                try {
                  logger.info(`Fetching repositories for space: ${space.name}`);
                  const repositories = await apiClient.spaces.getRepositories(
                    space.name
                  );
                  logger.info(
                    `Space ${space.name} has ${repositories.length} repositories`
                  );
                  repositories.forEach((repo) => {
                    logger.info(
                      `  - Repository: ${repo.name}, URL: ${repo.repository_url}`
                    );
                  });

                  const hasRepo = repositories.some((repo) => {
                    if (!repo.repository_url) {
                      logger.debug(
                        `Repository ${repo.name} has no repository_url`
                      );
                      return false;
                    }
                    const matches = isSameRepository(
                      repo.repository_url,
                      currentRepoUrl
                    );
                    logger.info(
                      `  Comparing: ${repo.repository_url} vs ${currentRepoUrl} = ${matches}`
                    );
                    return matches;
                  });

                  logger.info(
                    `Space ${space.name} ${hasRepo ? "CONTAINS" : "does NOT contain"} the repository`
                  );
                  return { spaceName: space.name, hasRepo };
                } catch (error) {
                  logger.error(
                    `Failed to get repositories for space ${space.name}`,
                    error as Error
                  );
                  return { spaceName: space.name, hasRepo: false };
                }
              })
            );

            // Build map of which spaces have the repo
            repoCheckResults.forEach(({ spaceName, hasRepo }) => {
              spaceHasRepo.set(spaceName, hasRepo);
            });

            const matchingCount = repoCheckResults.filter(
              (r) => r.hasRepo
            ).length;
            logger.info(
              `${matchingCount} space(s) contain the current repository`
            );
          } else {
            logger.warn(
              "No Git repository found, all spaces will be selectable"
            );
          }

          // Get current active space and default space
          const currentActiveSpace =
            await settingsManager.getSetting<string>("activeSpace");
          const defaultSpace =
            await settingsManager.getSetting<string>("space");

          // Create quick pick items - show all spaces but disable those without the repo
          const spaceItems = allSpaces.map((space) => {
            const isActive = space.name === currentActiveSpace;
            const isDefault = space.name === defaultSpace;
            const hasRepo = currentRepoUrl
              ? spaceHasRepo.get(space.name) === true
              : true;

            let label = space.name;
            let description = space.description ?? "";

            // Add status indicators
            if (isActive && isDefault) {
              label = `$(check) ${label} (Active & Default)`;
            } else if (isActive) {
              label = `$(check) ${label} (Active)`;
            } else if (isDefault && !currentActiveSpace) {
              // Default space is active when no override is set
              label = `$(check) ${label} (Default - Active)`;
            } else if (isDefault) {
              description = `${description ? description + " - " : ""}Default Space`;
            }

            // Add repo status for disabled items
            if (!hasRepo) {
              description = `${description ? description + " - " : ""}[REPO NOT IN SPACE]`;
            }

            return {
              label,
              description,
              spaceName: space.name,
              // Disable items that don't have the repo (unless no repo was detected)
              disabled: !hasRepo
            };
          });

          // Add option to clear active space (use default)
          const clearOption = {
            label: "$(circle-slash) Use Default Space",
            description: defaultSpace
              ? `Clear active space and use default: ${defaultSpace}`
              : "Clear active space setting",
            spaceName: null as string | null,
            disabled: false
          };

          const allItems = [clearOption, ...spaceItems];

          // Show space selection with custom filter to prevent selecting disabled items
          const selected = await vscode.window.showQuickPick(
            allItems.map((item) => ({
              ...item,
              // Use X icon for disabled items to distinguish from "Use Default Space"
              label: item.disabled ? `$(x) ${item.label}` : item.label,
              // Mark as picked: false to visually distinguish
              picked: false
            })),
            {
              placeHolder: currentActiveSpace
                ? `Current active space: ${currentActiveSpace}`
                : defaultSpace
                  ? `Active space: ${defaultSpace} (Default)`
                  : "Select active Torque space for this workspace",
              title: "Set Active Torque Space",
              // Enable matching on description to help find spaces
              matchOnDescription: true
            }
          );

          if (selected === undefined) {
            return; // User cancelled
          }

          // Prevent selecting disabled items
          if (selected.disabled) {
            vscode.window.showWarningMessage(
              `Cannot select "${selected.spaceName}" - repository not found in this space.`
            );
            return;
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
