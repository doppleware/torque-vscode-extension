/**
 * Add Grain Script Command
 *
 * Allows users to add post-helm-install scripts to grains in blueprint YAML files.
 * Users can choose to:
 * - Select an existing script file from the file explorer
 * - Create a new script file
 *
 * The script is added to the grain's scripts section with default values that users
 * can customize directly in the YAML file:
 *
 * scripts:
 *   post-helm-install:
 *     source:
 *       store: my-repo              # Auto-detected from Git repository
 *       path: scripts/script.sh     # Path to the selected/created script
 *     arguments: ""                 # Empty - user fills in as needed
 *     outputs:
 *       - output1                    # Default output names
 *       - output2
 */

import * as vscode from "vscode";
import * as path from "path";
import * as yaml from "js-yaml";
import { logger } from "../../../utils/Logger";
import { getRepositoryName } from "../../../utils/git";

interface ScriptConfig {
  store: string;
  path: string;
  arguments?: string;
  outputs?: string[];
}

/**
 * Register the add grain script command
 */
export function registerAddGrainScriptCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "torque.addGrainScript",
    async (blueprintUri: vscode.Uri, grainName: string, grainLine: number) => {
      try {
        logger.info(
          `Add grain script command invoked for grain: ${grainName} at line ${grainLine}`
        );

        // Prompt user to choose between existing and new script
        const scriptChoice = await vscode.window.showQuickPick(
          [
            {
              label: "$(file) Existing Script",
              description: "Select an existing script file from the workspace",
              choice: "existing"
            },
            {
              label: "$(new-file) New Script",
              description: "Create a new script file",
              choice: "new"
            }
          ],
          {
            placeHolder: "Choose script type",
            title: `Add Script to ${grainName}`
          }
        );

        if (!scriptChoice) {
          logger.info("User cancelled script type selection");
          return;
        }

        logger.info(`User selected: ${scriptChoice.choice}`);

        let scriptPath: string | undefined;
        let storeName: string | undefined;

        if (scriptChoice.choice === "existing") {
          // Handle existing script selection
          const result = await handleExistingScript(blueprintUri);
          if (!result) {
            return;
          }
          scriptPath = result.scriptPath;
          storeName = result.storeName;
        } else {
          // Handle new script creation
          const result = await handleNewScript(blueprintUri);
          if (!result) {
            return;
          }
          scriptPath = result.scriptPath;
          storeName = result.storeName;
        }

        // Build the script configuration with default values
        // User will fill in arguments and outputs directly in the YAML
        const scriptConfig: ScriptConfig = {
          store: storeName,
          path: scriptPath,
          arguments: "",
          outputs: ["output1", "output2"]
        };

        // Add the script to the grain in the YAML file
        await addScriptToGrain(
          blueprintUri,
          grainName,
          grainLine,
          scriptConfig
        );

        vscode.window.showInformationMessage(
          `Script added to grain '${grainName}' successfully`
        );
      } catch (error) {
        logger.error("Error in add grain script command", error as Error);
        vscode.window.showErrorMessage(
          `Failed to add script: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

/**
 * Handle existing script selection
 */
async function handleExistingScript(
  blueprintUri: vscode.Uri
): Promise<{ scriptPath: string; storeName: string } | undefined> {
  // Open file dialog to select existing script
  const fileUris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "Select Script",
    filters: {
      "Shell Scripts": ["sh", "bash"],
      "All Files": ["*"]
    },
    defaultUri: vscode.workspace.getWorkspaceFolder(blueprintUri)?.uri
  });

  if (!fileUris || fileUris.length === 0) {
    logger.info("User cancelled file selection");
    return undefined;
  }

  const scriptUri = fileUris[0];
  logger.info(`User selected script: ${scriptUri.fsPath}`);

  // Try to determine relative path from workspace root
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(blueprintUri);
  let relativePath: string;

  if (workspaceFolder) {
    relativePath = path.relative(workspaceFolder.uri.fsPath, scriptUri.fsPath);
  } else {
    // If no workspace folder, use the path relative to the blueprint
    const blueprintDir = path.dirname(blueprintUri.fsPath);
    relativePath = path.relative(blueprintDir, scriptUri.fsPath);
  }

  logger.info(`Relative script path: ${relativePath}`);

  // Try to get the repository name from Git
  const detectedRepoName = await getRepositoryName(workspaceFolder);
  logger.info(
    `Detected repository name: ${detectedRepoName ?? "not detected"}`
  );

  // Prompt for store name with detected repo as default
  const storeName = await vscode.window.showInputBox({
    prompt: "Enter the store name for this script",
    placeHolder: detectedRepoName ?? "my-repo",
    value: detectedRepoName ?? "",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Store name is required";
      }
      return null;
    }
  });

  if (!storeName) {
    return undefined;
  }

  // Convert Windows paths to forward slashes
  const normalizedPath = relativePath.replace(/\\/g, "/");

  return {
    scriptPath: normalizedPath,
    storeName: storeName.trim()
  };
}

/**
 * Handle new script creation
 */
async function handleNewScript(
  blueprintUri: vscode.Uri
): Promise<{ scriptPath: string; storeName: string } | undefined> {
  // Prompt for script name
  const scriptName = await vscode.window.showInputBox({
    prompt: "Enter the name for the new script",
    placeHolder: "get-outputs.sh",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Script name is required";
      }
      // Check for valid filename characters
      if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
        return "Script name contains invalid characters";
      }
      return null;
    }
  });

  if (!scriptName) {
    return undefined;
  }

  // Prompt for script directory relative to workspace
  const scriptDir = await vscode.window.showInputBox({
    prompt: "Enter the directory for the script (relative to workspace root)",
    placeHolder: "scripts",
    value: "scripts"
  });

  if (scriptDir === undefined) {
    return undefined;
  }

  // Determine the full path for the new script
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(blueprintUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found");
    return undefined;
  }

  const scriptPath = path.join(
    workspaceFolder.uri.fsPath,
    scriptDir.trim(),
    scriptName.trim()
  );

  logger.info(`Creating new script at: ${scriptPath}`);

  // Create the directory if it doesn't exist
  const scriptDirPath = path.dirname(scriptPath);
  const scriptDirUri = vscode.Uri.file(scriptDirPath);

  try {
    await vscode.workspace.fs.createDirectory(scriptDirUri);
  } catch {
    // Directory might already exist, that's OK
    logger.info(`Directory already exists or created: ${scriptDirPath}`);
  }

  // Create the new script file with a basic template
  const scriptUri = vscode.Uri.file(scriptPath);
  const scriptContent = `#!/bin/bash
# Post-helm-install script
# Add your script logic here

echo "Script execution started"

# Your code here

echo "Script execution completed"
`;

  await vscode.workspace.fs.writeFile(
    scriptUri,
    Buffer.from(scriptContent, "utf-8")
  );

  logger.info(`Created new script file: ${scriptPath}`);

  // Open the newly created script file
  const document = await vscode.workspace.openTextDocument(scriptUri);
  await vscode.window.showTextDocument(document);

  // Try to get the repository name from Git
  const detectedRepoName = await getRepositoryName(workspaceFolder);
  logger.info(
    `Detected repository name: ${detectedRepoName ?? "not detected"}`
  );

  // Prompt for store name with detected repo as default
  const storeName = await vscode.window.showInputBox({
    prompt: "Enter the store name for this script",
    placeHolder: detectedRepoName ?? "my-repo",
    value: detectedRepoName ?? "",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Store name is required";
      }
      return null;
    }
  });

  if (!storeName) {
    return undefined;
  }

  // Get relative path from workspace root
  const relativePath = path.join(scriptDir.trim(), scriptName.trim());
  const normalizedPath = relativePath.replace(/\\/g, "/");

  return {
    scriptPath: normalizedPath,
    storeName: storeName.trim()
  };
}

/**
 * Add script configuration to the grain in the YAML file
 */
async function addScriptToGrain(
  blueprintUri: vscode.Uri,
  grainName: string,
  grainLine: number,
  scriptConfig: ScriptConfig
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(blueprintUri);
  const text = document.getText();

  try {
    // Parse the YAML document
    const yamlDoc = yaml.load(text) as Record<string, unknown>;

    if (
      !yamlDoc.grains ||
      typeof yamlDoc.grains !== "object" ||
      !(grainName in (yamlDoc.grains as Record<string, unknown>))
    ) {
      throw new Error(`Grain '${grainName}' not found in the blueprint`);
    }

    const grains = yamlDoc.grains as Record<string, Record<string, unknown>>;
    const grain = grains[grainName];

    // Initialize scripts section if it doesn't exist
    grain.spec ??= {};
    const spec = grain.spec as Record<string, unknown>;

    spec.scripts ??= {};
    const scripts = spec.scripts as Record<string, unknown>;

    // Add or update the post-helm-install script
    // Always include arguments and outputs with default values for the user to customize
    const postHelmInstall: Record<string, unknown> = {
      source: {
        store: scriptConfig.store,
        path: scriptConfig.path
      },
      arguments: scriptConfig.arguments,
      outputs: scriptConfig.outputs
    };

    scripts["post-helm-install"] = postHelmInstall;

    // Convert back to YAML with proper formatting
    const updatedYaml = yaml.dump(yamlDoc, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });

    // Preserve the schema comment in the first line
    const firstLine = document.lineAt(0).text;
    let finalYaml = updatedYaml;

    if (firstLine.startsWith("#")) {
      finalYaml = firstLine + "\n" + updatedYaml;
    }

    // Apply the edit to the document
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      0,
      0,
      document.lineCount,
      document.lineAt(document.lineCount - 1).text.length
    );

    edit.replace(blueprintUri, fullRange, finalYaml);
    await vscode.workspace.applyEdit(edit);

    // Save the document
    await document.save();

    logger.info(`Successfully added script to grain '${grainName}'`);
  } catch (error) {
    logger.error("Error parsing or updating YAML", error as Error);
    throw new Error(
      `Failed to update blueprint: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
