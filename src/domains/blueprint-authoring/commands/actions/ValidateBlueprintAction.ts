/**
 * Validate Blueprint Action
 */

import * as vscode from "vscode";
import { logger } from "../../../../utils/Logger";
import { BaseBlueprintAction } from "./BaseBlueprintAction";
import type { ApiClient } from "../../../../api/ApiClient";
import type { SettingsManager } from "../../../setup/SettingsManager";

export class ValidateBlueprintAction extends BaseBlueprintAction {
  constructor(
    settingsManager: SettingsManager,
    getApiClient: () => ApiClient | null,
    private readonly diagnostics: vscode.DiagnosticCollection
  ) {
    super(settingsManager, getApiClient);
  }

  async execute(uri: vscode.Uri): Promise<void> {
    logger.info(`Validating blueprint: ${uri.fsPath}`);

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

      // Read the blueprint file
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();

      const blueprintName = this.getBlueprintName(uri);

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
          const result = await client.spaces.validateBlueprint(
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
          const diagnosticsList: vscode.Diagnostic[] = [];

          // Add errors as diagnostics
          if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error) => {
              // Try to extract YAML path from error message to find the actual line
              const range = this.findErrorLocation(document, error);

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

              diagnosticsList.push(diagnostic);
            });
          }

          // Add warnings as diagnostics
          if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach((warning) => {
              const range = this.findErrorLocation(document, warning);

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

              diagnosticsList.push(diagnostic);
            });
          }

          // Update the diagnostic collection
          this.diagnostics.set(uri, diagnosticsList);

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
      logger.error("Error validating blueprint", error as Error);
      vscode.window.showErrorMessage(
        `Failed to validate blueprint: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find the error location in the document by parsing the YAML path from the error message
   */
  private findErrorLocation(
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
        const partPattern = new RegExp(
          `^\\s*-?\\s*${this.escapeRegExp(part)}\\s*:`
        );
        if (partPattern.test(line)) {
          // Found it! Update our search position
          searchIndex = i + 1;
          found = true;
          logger.info(`Found "${part}" at line ${i + 1}`);

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
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
