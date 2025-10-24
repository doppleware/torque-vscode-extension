import fs from "fs";
import os from "os";
import path from "path";
import vscode from "vscode";
import type { ApiClient } from "../../../api/ApiClient";
import { TorqueEnvironmentDetailsTool } from "../tools/TorqueEnvironmentDetailsTool";
import { getIdeCommand } from "../../../ides/ideCommands";
import { getClient } from "../../../extension";
import { logger } from "../../../utils/Logger";
import {
  EnvironmentDetailsTransformer,
  type SimplifiedEnvironmentDetails
} from "../transformers/EnvironmentDetailsTransformer";

interface EnvironmentContextParams {
  space_name: string;
  environment_id: string;
}

/**
 * Extracts grain names from the environment blueprint definition
 */
const extractGrainNames = (environmentDetails: unknown): string[] => {
  const grainNames: string[] = [];

  try {
    // First check if environmentDetails has the expected structure
    if (!environmentDetails || typeof environmentDetails !== "object") {
      logger.info("Invalid environment details structure");
      return grainNames;
    }

    const envDetails = environmentDetails as {
      details?: {
        state?: {
          grains?: { name?: string }[];
        };
      };
    };

    // The grains are in details.state.grains, not details.definition.grains
    const stateGrains = envDetails.details?.state?.grains;

    if (!stateGrains || !Array.isArray(stateGrains)) {
      logger.info("No grains array found in environment state");
      return grainNames;
    }

    stateGrains.forEach((grain) => {
      if (grain.name) {
        grainNames.push(grain.name);
      }
    });

    logger.info(
      `Extracted ${grainNames.length} grain names: ${grainNames.join(", ")}`
    );
  } catch (error) {
    logger.error(
      `Error extracting grain names: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return grainNames;
};

/**
 * Fetches introspection resources for each grain
 */
const fetchGrainResources = async (
  spaceName: string,
  environmentId: string,
  grainNames: string[],
  client?: ApiClient
): Promise<
  {
    grain_name: string;
    resources: {
      name: string;
      type: string;
      dependency_identifier: string;
      attributes?: Record<string, string>;
      tags?: Record<string, string>;
      depends_on?: string[];
    }[];
  }[]
> => {
  const grainResourcesList: {
    grain_name: string;
    resources: {
      name: string;
      type: string;
      dependency_identifier: string;
      attributes?: Record<string, string>;
      tags?: Record<string, string>;
      depends_on?: string[];
    }[];
  }[] = [];

  if (grainNames.length === 0) {
    logger.info("No grains to fetch resources for");
    return grainResourcesList;
  }

  const apiClient = client ?? getClient();
  const spacesService = apiClient.spaces;

  // Fetch introspection data for each grain
  for (const grainName of grainNames) {
    try {
      logger.info(`Fetching introspection for grain: ${grainName}`);
      const introspectionData = await spacesService.getEnvironmentIntrospection(
        spaceName,
        environmentId,
        grainName
      );

      grainResourcesList.push({
        grain_name: grainName,
        resources: introspectionData.resources || []
      });

      logger.info(
        `Fetched ${introspectionData.resources?.length ?? 0} resources for grain: ${grainName}`
      );
    } catch (error) {
      logger.error(
        `Error fetching introspection for grain ${grainName}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      // Continue with other grains even if one fails
      grainResourcesList.push({
        grain_name: grainName,
        resources: []
      });
    }
  }

  return grainResourcesList;
};

/**
 * Fetches workflows for all resources in all grains and attaches them to the grains
 * Groups workflows by workflow name and lists which resources they apply to
 */
const fetchAndAttachWorkflows = async (
  spaceName: string,
  environmentId: string,
  simplifiedDetails: SimplifiedEnvironmentDetails,
  client?: ApiClient
): Promise<void> => {
  const apiClient = client ?? getClient();
  const spacesService = apiClient.spaces;

  // Iterate through each grain
  for (const grainObj of simplifiedDetails.grains) {
    // Get the grain name (key) and details (value)
    const grainName = Object.keys(grainObj)[0];
    const grainDetails = grainObj[grainName];

    if (!grainDetails?.resources || grainDetails.resources.length === 0) {
      logger.info(
        `No resources for grain: ${grainName}, skipping workflow fetch`
      );
      continue;
    }

    // Map to store workflows grouped by blueprint_name
    const workflowMap = new Map<
      string,
      {
        inputs: { name: string; type: string }[];
        resources: Set<string>;
      }
    >();

    // Fetch workflows for each resource in this grain
    for (const resource of grainDetails.resources) {
      try {
        logger.info(
          `Fetching workflows for resource: ${resource.name} in grain: ${grainName}`
        );

        const workflowsData = await spacesService.getResourceWorkflows(
          spaceName,
          environmentId,
          grainDetails.path,
          resource.name
        );

        // Process each workflow instantiation
        for (const instantiation of workflowsData.instantiations || []) {
          const workflowName = instantiation.blueprint_name;

          if (!workflowMap.has(workflowName)) {
            // First time seeing this workflow, create entry
            workflowMap.set(workflowName, {
              inputs: instantiation.inputs.map((input) => ({
                name: input.name,
                type: input.type
              })),
              resources: new Set()
            });
          }

          // Add this resource to the workflow's resource list
          workflowMap.get(workflowName)!.resources.add(resource.name);
        }

        logger.info(
          `Found ${workflowsData.instantiations?.length ?? 0} workflows for resource: ${resource.name}`
        );
      } catch (error) {
        logger.error(
          `Error fetching workflows for resource ${resource.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        // Continue with other resources even if one fails
      }
    }

    // Convert the workflow map to the final array format
    grainDetails.workflows = Array.from(workflowMap.entries()).map(
      ([name, data]) => ({
        name,
        resources: Array.from(data.resources),
        inputs: data.inputs
      })
    );

    logger.info(
      `Attached ${grainDetails.workflows.length} unique workflows to grain: ${grainName}`
    );
  }
};

/**
 * Internal function that performs the actual work of fetching environment details
 * Used by the public wrapper with progress reporting
 */
const attachEnvironmentFileToChatContextInternal = async (
  spaceName: string,
  environmentId: string,
  client?: ApiClient,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
) => {
  // Validate input parameters
  if (!spaceName || !environmentId) {
    throw new Error("Space name and environment ID are required");
  }

  // Step 1: Fetch environment details (20% of work)
  progress?.report({
    message: "Fetching environment details...",
    increment: 0
  });
  const environmentTool = new TorqueEnvironmentDetailsTool(client);
  const environmentDetails = await environmentTool.getEnvironmentDetailsJson(
    spaceName,
    environmentId
  );

  if (!environmentDetails) {
    throw new Error("No environment details retrieved");
  }

  progress?.report({ increment: 20 });

  // Step 2: Extract grain names and fetch resources (30% of work)
  const grainNames = extractGrainNames(environmentDetails);
  progress?.report({
    message: `Fetching resources for ${grainNames.length} grain(s)...`,
    increment: 10
  });

  const grainResources = await fetchGrainResources(
    spaceName,
    environmentId,
    grainNames,
    client
  );

  progress?.report({ increment: 20 });

  // Step 3: Transform data (10% of work)
  progress?.report({
    message: "Processing environment data...",
    increment: 10
  });
  const simplifiedDetails = EnvironmentDetailsTransformer.transform(
    environmentDetails,
    grainResources
  );

  progress?.report({ increment: 10 });

  // Step 4: Fetch workflows (30% of work)
  const totalResources = simplifiedDetails.grains.reduce((sum, grainObj) => {
    const grainDetails = Object.values(grainObj)[0];
    return sum + (grainDetails?.resources?.length ?? 0);
  }, 0);

  progress?.report({
    message: `Fetching workflows for ${totalResources} resource(s)...`,
    increment: 0
  });

  await fetchAndAttachWorkflows(
    spaceName,
    environmentId,
    simplifiedDetails,
    client
  );

  progress?.report({ increment: 20 });

  // Step 5: Create and attach file (10% of work)
  progress?.report({ message: "Creating context file...", increment: 0 });

  // Extract environment name from metadata
  let environmentName = environmentId; // Fallback to ID
  try {
    const envData = environmentDetails as {
      details?: {
        definition?: {
          metadata?: {
            name?: string;
          };
        };
      };
    };
    environmentName =
      envData.details?.definition?.metadata?.name ?? environmentId;
  } catch {
    // Use fallback if extraction fails
    logger.warn("Could not extract environment name from metadata");
  }

  // Create temporary file with environment name
  const tempDir = os.tmpdir();
  // Sanitize the environment name for use in filename
  const sanitizedName = environmentName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const fileName = `${sanitizedName}.yaml`;
  const filePath = path.join(tempDir, fileName);

  // Write simplified YAML content to file
  fs.writeFileSync(
    filePath,
    EnvironmentDetailsTransformer.toYAML(simplifiedDetails),
    "utf8"
  );

  progress?.report({ increment: 5 });

  // Open chat and attach file
  progress?.report({ message: "Attaching to chat...", increment: 0 });
  const openChatCommand = getIdeCommand("OPEN_CHAT");
  await vscode.commands.executeCommand(openChatCommand);

  const attachFileToChatCommand = getIdeCommand("ATTACH_FILE_TO_CHAT");
  await vscode.commands.executeCommand(
    attachFileToChatCommand,
    vscode.Uri.file(filePath)
  );

  progress?.report({ increment: 5 });

  vscode.window.showInformationMessage(
    "Environment details have been added to the chat context"
  );
};

/**
 * Attaches environment details to chat context with progress reporting
 * This is the public API that wraps the internal implementation
 */
export const attachEnvironmentFileToChatContext = async (
  spaceName: string,
  environmentId: string,
  client?: ApiClient
): Promise<void> => {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Loading Environment Context",
      cancellable: false
    },
    async (progress) => {
      try {
        await attachEnvironmentFileToChatContextInternal(
          spaceName,
          environmentId,
          client,
          progress
        );
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(
          "Error attaching environment file to chat context:",
          error
        );

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
        throw error; // Re-throw to indicate failure
      }
    }
  );
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
