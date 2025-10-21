/**
 * Blueprint Actions Command
 *
 * Provides a QuickPick menu with actions for Torque blueprint files:
 * - Validate: Validate the blueprint
 * - Deploy: Deploy the blueprint
 */

import * as vscode from "vscode";
import { logger } from "../../../utils/Logger";
import type { ApiClient } from "../../../api/ApiClient";
import type { SettingsManager } from "../../setup/SettingsManager";
import type { AxiosError } from "axios";

// Create a diagnostic collection for blueprint validation
const blueprintDiagnostics =
  vscode.languages.createDiagnosticCollection("torque-blueprint");

/**
 * Register the blueprint actions command
 */
export function registerBlueprintActionsCommand(
  settingsManager: SettingsManager,
  getApiClient: () => ApiClient | null
): vscode.Disposable {
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

        // Execute the selected action
        switch (action.action) {
          case "validate":
            await validateBlueprint(uri, settingsManager, getApiClient);
            break;
          case "sync":
            await syncBlueprintFromScm(uri, settingsManager, getApiClient);
            break;
          case "deploy":
            deployBlueprint(uri);
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

/**
 * Validate a blueprint
 */
async function validateBlueprint(
  uri: vscode.Uri,
  settingsManager: SettingsManager,
  getApiClient: () => ApiClient | null
): Promise<void> {
  logger.info(`Validating blueprint: ${uri.fsPath}`);

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

    // Get the active space
    const activeSpace = await settingsManager.getSetting<string>("activeSpace");
    const defaultSpace = await settingsManager.getSetting<string>("space");
    const spaceName = activeSpace ?? defaultSpace;

    if (!spaceName) {
      vscode.window.showErrorMessage(
        "No active space set. Please set an active space first."
      );
      return;
    }

    // Read the blueprint file
    const document = await vscode.workspace.openTextDocument(uri);
    const content = document.getText();

    // Get the blueprint name from the file name
    const fileName = uri.fsPath.split("/").pop() ?? "blueprint.yaml";
    const blueprintName = fileName.replace(/\.ya?ml$/i, "");

    // Convert content to base64
    const contentBase64 = Buffer.from(content).toString("base64");

    logger.info(
      `Validating blueprint "${blueprintName}" in space "${spaceName}"`
    );

    // Log the full request for debugging
    const validationRequest = {
      blueprint_name: blueprintName,
      blueprint_raw_64: contentBase64
    };
    logger.info("=== Validation Request Details ===");
    logger.info(`Space: ${spaceName}`);
    logger.info(`Blueprint Name: ${blueprintName}`);
    logger.info(`File Path: ${uri.fsPath}`);
    logger.info(`Content Length: ${content.length} characters`);
    logger.info(`Base64 Length: ${contentBase64.length} characters`);
    logger.info(`Base64 Content:\n${contentBase64}`);
    logger.info(
      `Full Request Payload:\n${JSON.stringify(validationRequest, null, 2)}`
    );
    logger.info("=================================");

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Validating blueprint "${blueprintName}"...`,
        cancellable: false
      },
      async () => {
        // Call the validation API
        const result = await apiClient.spaces.validateBlueprint(
          spaceName,
          validationRequest
        );

        // Log the response for debugging
        logger.info("=== Validation Response ===");
        logger.info(`Response:\n${JSON.stringify(result, null, 2)}`);
        logger.info("===========================");

        // Check if validation passed (no errors)
        const errorCount = result.errors?.length ?? 0;
        const warningCount = result.warnings?.length ?? 0;
        const isValid = errorCount === 0;

        // Create diagnostics for the Problems panel
        const diagnostics: vscode.Diagnostic[] = [];

        // Add errors as diagnostics
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach((error) => {
            // Try to extract YAML path from error message to find the actual line
            const range = findErrorLocation(document, error);

            const diagnostic = new vscode.Diagnostic(
              range,
              error.message,
              vscode.DiagnosticSeverity.Error
            );

            // Add additional information
            if (error.code) {
              diagnostic.code = error.code;
            }
            if (error.name) {
              diagnostic.source = `Torque: ${error.name}`;
            } else {
              diagnostic.source = "Torque Validation";
            }

            diagnostics.push(diagnostic);
          });
        }

        // Add warnings as diagnostics
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning) => {
            const range = findErrorLocation(document, warning);

            const diagnostic = new vscode.Diagnostic(
              range,
              warning.message,
              vscode.DiagnosticSeverity.Warning
            );

            if (warning.code) {
              diagnostic.code = warning.code;
            }
            if (warning.name) {
              diagnostic.source = `Torque: ${warning.name}`;
            } else {
              diagnostic.source = "Torque Validation";
            }

            diagnostics.push(diagnostic);
          });
        }

        // Update the diagnostic collection
        blueprintDiagnostics.set(uri, diagnostics);

        // Display the results
        if (isValid) {
          if (warningCount > 0) {
            vscode.window.showWarningMessage(
              `Blueprint "${blueprintName}" is valid with ${warningCount} warning${warningCount > 1 ? "s" : ""}`
            );
          } else {
            vscode.window.showInformationMessage(
              `✓ Blueprint "${blueprintName}" is valid!`
            );
          }
        }

        // Log and display errors if any
        if (result.errors && result.errors.length > 0) {
          logger.error("=== Validation Errors ===");
          result.errors.forEach((error, index) => {
            logger.error(`Error ${index + 1}:`);
            logger.error(`  Message: ${error.message}`);
            if (error.name) {
              logger.error(`  Name: ${error.name}`);
            }
            if (error.code) {
              logger.error(`  Code: ${error.code}`);
            }
            if (error.line) {
              logger.error(
                `  Line: ${error.line}${error.column ? `, Column: ${error.column}` : ""}`
              );
            }
            if (error.path) {
              logger.error(`  Path: ${error.path}`);
            }
            logger.error(""); // Empty line for readability
          });
          logger.error("=========================");

          // Show simple error message referencing Problems panel
          vscode.window.showErrorMessage(
            `Blueprint "${blueprintName}" validation failed with ${result.errors.length} error${result.errors.length > 1 ? "s" : ""}. See Problems panel for details.`
          );
        }

        // Log warnings if any
        if (result.warnings && result.warnings.length > 0) {
          logger.warn("=== Validation Warnings ===");
          result.warnings.forEach((warning, index) => {
            logger.warn(`Warning ${index + 1}:`);
            logger.warn(`  Message: ${warning.message}`);
            if (warning.name) {
              logger.warn(`  Name: ${warning.name}`);
            }
            if (warning.code) {
              logger.warn(`  Code: ${warning.code}`);
            }
            if (warning.line) {
              logger.warn(
                `  Line: ${warning.line}${warning.column ? `, Column: ${warning.column}` : ""}`
              );
            }
            if (warning.path) {
              logger.warn(`  Path: ${warning.path}`);
            }
            logger.warn(""); // Empty line for readability
          });
          logger.warn("===========================");
        }
      }
    );
  } catch (error) {
    logger.error("=== Validation API Error ===");
    logger.error("Error validating blueprint", error as Error);

    // Log additional error details if available
    if (error && typeof error === "object") {
      logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);

      // Log axios error details if available
      if ("response" in error) {
        const axiosError = error as AxiosError;
        logger.error(
          `HTTP Status: ${axiosError.response?.status ?? "unknown"}`
        );
        logger.error(
          `Response Data: ${JSON.stringify(axiosError.response?.data ?? {}, null, 2)}`
        );
        logger.error(`Request URL: ${axiosError.config?.url ?? "unknown"}`);
        logger.error(
          `Request Method: ${axiosError.config?.method ?? "unknown"}`
        );
      }
    }
    logger.error("============================");

    vscode.window.showErrorMessage(
      `Failed to validate blueprint: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Sync a blueprint from SCM
 */
async function syncBlueprintFromScm(
  uri: vscode.Uri,
  settingsManager: SettingsManager,
  getApiClient: () => ApiClient | null
): Promise<void> {
  logger.info(`Syncing blueprint from SCM: ${uri.fsPath}`);

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

    // Get the active space
    const activeSpace = await settingsManager.getSetting<string>("activeSpace");
    const defaultSpace = await settingsManager.getSetting<string>("space");
    const spaceName = activeSpace ?? defaultSpace;

    if (!spaceName) {
      vscode.window.showErrorMessage(
        "No active space set. Please set an active space first."
      );
      return;
    }

    // Get the blueprint name from the file name
    const fileName = uri.fsPath.split("/").pop() ?? "blueprint.yaml";
    const blueprintName = fileName.replace(/\.ya?ml$/i, "");

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

    // Show progress and call the sync API
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Syncing blueprint "${blueprintName}" from SCM...`,
        cancellable: false
      },
      async () => {
        await apiClient.spaces.syncBlueprintFromScm(
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
    logger.error("=== Sync API Error ===");
    logger.error("Error syncing blueprint from SCM", error as Error);

    // Log additional error details if available
    if (error && typeof error === "object") {
      logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);

      // Log axios error details if available
      if ("response" in error) {
        const axiosError = error as AxiosError;
        logger.error(
          `HTTP Status: ${axiosError.response?.status ?? "unknown"}`
        );
        logger.error(
          `Response Data: ${JSON.stringify(axiosError.response?.data ?? {}, null, 2)}`
        );
        logger.error(`Request URL: ${axiosError.config?.url ?? "unknown"}`);
        logger.error(
          `Request Method: ${axiosError.config?.method ?? "unknown"}`
        );
      }
    }
    logger.error("======================");

    vscode.window.showErrorMessage(
      `Failed to sync blueprint from SCM: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deploy a blueprint (placeholder implementation)
 */
function deployBlueprint(uri: vscode.Uri): void {
  logger.info(`Deploying blueprint: ${uri.fsPath}`);

  // TODO: Implement actual deployment logic
  // For now, just show a success message
  vscode.window.showInformationMessage(
    `Deploy action called for: ${uri.fsPath.split("/").pop() ?? uri.fsPath}`
  );
}

/**
 * Find the error location in the document by parsing the YAML path from the error message
 * Example: "The agent 'AGENT_NAME (in grains->hello-world-chart->spec->agent->name)' was not found"
 * Extracts: grains->hello-world-chart->spec->agent->name
 */
function findErrorLocation(
  document: vscode.TextDocument,
  error: { message: string; line?: number; column?: number }
): vscode.Range {
  // If the error has explicit line/column, use those
  if (error.line && error.line > 0) {
    const line = error.line - 1; // VS Code is 0-indexed
    const column = error.column ? error.column - 1 : 0;
    return new vscode.Range(line, column, line, column + 100);
  }

  // Try to extract YAML path from error message
  // Pattern: (in path->to->element)
  const pathMatch = /\(in ([^)]+)\)/.exec(error.message);
  if (!pathMatch) {
    // No path found, return first line
    return new vscode.Range(0, 0, 0, 100);
  }

  const yamlPath = pathMatch[1];
  const pathParts = yamlPath.split("->").map((p) => p.trim());

  logger.info(`Searching for YAML path: ${pathParts.join(" -> ")}`);

  // Search through the document to find the path
  const text = document.getText();
  const lines = text.split("\n");

  let currentIndent = 0;
  let searchIndex = 0;

  for (const part of pathParts) {
    let found = false;

    // Search for this part starting from searchIndex
    for (let i = searchIndex; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Check if this line contains the part we're looking for
      // It could be "part:" or "- part:" or just "part"
      const partPattern = new RegExp(`^\\s*-?\\s*${escapeRegExp(part)}\\s*:`);
      if (partPattern.test(line)) {
        // Found it! Update our search position
        searchIndex = i + 1;
        currentIndent = line.search(/\S/); // Get the indentation level
        found = true;
        logger.info(
          `Found "${part}" at line ${i + 1}, indent ${currentIndent}`
        );

        // If this is the last part, this is our error line
        if (part === pathParts[pathParts.length - 1]) {
          const column = line.indexOf(part);
          const endColumn = column + part.length + 1; // Include the colon
          return new vscode.Range(i, column, i, endColumn);
        }

        break;
      }
    }

    if (!found) {
      logger.warn(`Could not find "${part}" in YAML path`);
      break;
    }
  }

  // Fallback: return the first line if we couldn't find the exact location
  logger.warn("Could not locate error in file, using first line");
  return new vscode.Range(0, 0, 0, 100);
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
