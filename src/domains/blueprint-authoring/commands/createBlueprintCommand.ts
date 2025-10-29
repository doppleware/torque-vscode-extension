/**
 * Create Blueprint Command
 *
 * Handles creation of new Torque Blueprint YAML files with proper template injection.
 * Includes filename validation, template injection, and editor integration.
 *
 * @see {@link file://../../spec/blueprint_yaml_support.md} Blueprint YAML Support Specification
 */

import * as vscode from "vscode";
import { BLUEPRINT_TEMPLATE } from "../templates/blueprintTemplate";
import { logger } from "../../../utils/Logger";

/**
 * Registers the torque.createBlueprint command
 *
 * @returns Disposable for command registration
 */
export function registerCreateBlueprintCommand():
  | vscode.Disposable
  | undefined {
  try {
    const command = vscode.commands.registerCommand(
      "torque.createBlueprint",
      async () => {
        await createBlueprint();
      }
    );
    logger.info("Registered torque.createBlueprint command");
    return command;
  } catch {
    logger.warn("Command torque.createBlueprint already registered, skipping");
    return undefined;
  }
}

/**
 * Creates a new blueprint YAML file with template content
 */
async function createBlueprint(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      "Please open a workspace folder before creating a Torque Blueprint"
    );
    return;
  }

  // Prompt for filename with validation
  const filename = await vscode.window.showInputBox({
    prompt: "Enter blueprint filename",
    placeHolder: "blueprint.yaml",
    validateInput: (value) => {
      if (!value) {
        return "Filename is required";
      }
      if (!value.endsWith(".yaml") && !value.endsWith(".yml")) {
        return "Filename must end with .yaml or .yml";
      }
      return undefined;
    }
  });

  if (!filename) {
    return;
  }

  // Create file in workspace root
  const workspaceRoot = workspaceFolders[0].uri;
  const blueprintUri = vscode.Uri.joinPath(workspaceRoot, filename);

  try {
    // Check if file already exists
    if (await fileExists(blueprintUri)) {
      const overwrite = await vscode.window.showWarningMessage(
        `File ${filename} already exists. Overwrite?`,
        "Yes",
        "No"
      );
      if (overwrite !== "Yes") {
        return;
      }
    }

    // Write the file
    await vscode.workspace.fs.writeFile(
      blueprintUri,
      Buffer.from(BLUEPRINT_TEMPLATE, "utf8")
    );

    // Open the file
    const document = await vscode.workspace.openTextDocument(blueprintUri);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
      `Torque Blueprint created: ${filename}`
    );
    logger.info(`Created Torque Blueprint: ${filename}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Failed to create blueprint: ${errorMessage}`
    );
    logger.error("Failed to create Torque Blueprint", error as Error);
  }
}

/**
 * Checks if a file exists at the given URI
 */
async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
