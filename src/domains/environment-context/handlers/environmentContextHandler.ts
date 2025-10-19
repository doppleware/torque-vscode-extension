import { formatISO } from "date-fns/formatISO";
import fs from "fs";
import os from "os";
import path from "path";
import vscode from "vscode";
import { TorqueEnvironmentDetailsTool } from "../tools/TorqueEnvironmentDetailsTool";
import { getIdeCommand } from "../../../ides/ideCommands";

interface EnvironmentContextParams {
  space_name: string;
  environment_id: string;
}

export const attachEnvironmentFileToChatContext = async (
  spaceName: string,
  environmentId: string
) => {
  try {
    // Validate input parameters
    if (!spaceName || !environmentId) {
      throw new Error("Space name and environment ID are required");
    }

    // Create tool instance and fetch environment details directly as JSON
    const environmentTool = new TorqueEnvironmentDetailsTool();

    // Get raw environment details JSON directly from the API
    const environmentDetails = await environmentTool.getEnvironmentDetailsJson(
      spaceName,
      environmentId
    );

    if (!environmentDetails) {
      throw new Error("No environment details retrieved");
    }

    // Create temporary file with JSON extension
    const tempDir = os.tmpdir();
    const fileName = `environment-${spaceName}-${environmentId}-${formatISO(
      new Date(),
      {
        format: "basic"
      }
    )}.json`;
    const filePath = path.join(tempDir, fileName);

    // Write JSON content to file
    fs.writeFileSync(
      filePath,
      JSON.stringify(environmentDetails, null, 2),
      "utf8"
    );

    // Open chat and attach file
    const openChatCommand = getIdeCommand("OPEN_CHAT");
    await vscode.commands.executeCommand(openChatCommand);

    const attachFileToChatCommand = getIdeCommand("ATTACH_FILE_TO_CHAT");
    await vscode.commands.executeCommand(
      attachFileToChatCommand,
      vscode.Uri.file(filePath)
    );

    vscode.window.showInformationMessage(
      `Environment details JSON for ${environmentId} have been attached to the chat context`
    );
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("Error attaching environment file to chat context:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Provide specific error messages based on error type
    let userMessage = `Failed to attach environment details to chat context: ${errorMessage}`;

    if (errorMessage.includes("API request failed")) {
      userMessage = `Unable to fetch environment details. Please check your Torque configuration and network connection.`;
    } else if (errorMessage.includes("Space name and environment ID")) {
      userMessage = `Invalid environment URL format. Please check the space name and environment ID.`;
    } else if (
      errorMessage.includes("ENOENT") ||
      errorMessage.includes("permission")
    ) {
      userMessage = `Unable to create temporary file. Please check file system permissions.`;
    }

    vscode.window.showErrorMessage(userMessage);
  }
};

/**
 * Handler for environment context URLs
 * Extracts space name and environment ID from URL parameters
 */
export const handleEnvironmentContextUrl = async (
  params: EnvironmentContextParams
): Promise<void> => {
  const { space_name, environment_id } = params;

  // URL decode parameters (they're already decoded by UriRouter but being explicit)
  const decodedSpaceName = decodeURIComponent(space_name);
  const decodedEnvironmentId = decodeURIComponent(environment_id);

  await attachEnvironmentFileToChatContext(
    decodedSpaceName,
    decodedEnvironmentId
  );
};
