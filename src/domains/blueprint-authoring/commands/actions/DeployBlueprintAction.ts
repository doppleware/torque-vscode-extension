/**
 * Deploy Blueprint Action
 *
 * Handles deploying blueprint environments to the Torque platform.
 * Parses blueprint inputs, fetches allowed values, shows interactive deployment form,
 * and deploys environments with user-provided values.
 *
 * @see {@link file://../../spec/environment_deployment.md} Environment Deployment Specification
 * @see {@link file://../../spec/blueprint_yaml_support.md} Blueprint YAML Support Specification
 */

import * as vscode from "vscode";
import * as yaml from "js-yaml";
import { logger } from "../../../../utils/Logger";
import { BaseBlueprintAction } from "./BaseBlueprintAction";
import { DeploymentForm } from "./DeploymentForm";
import type {
  InputDefinition,
  AllowedValuesResponse
} from "../../../../api/services/types";
import type { SettingsManager } from "../../../setup/SettingsManager";
import type { ApiClient } from "../../../../api/ApiClient";

const DEPLOYMENT_VALUES_KEY = "torque.deploymentValues";

type DeploymentCache = Record<
  string,
  {
    environmentName: string;
    inputs: Record<string, string>;
  }
>;

export class DeployBlueprintAction extends BaseBlueprintAction {
  constructor(
    settingsManager: SettingsManager,
    getApiClient: () => ApiClient | null,
    private readonly context: vscode.ExtensionContext
  ) {
    super(settingsManager, getApiClient);
  }

  /**
   * Get cached deployment values for a blueprint
   */
  private getCachedValues(
    blueprintName: string
  ): { environmentName: string; inputs: Record<string, string> } | undefined {
    const cache = this.context.workspaceState.get<DeploymentCache>(
      DEPLOYMENT_VALUES_KEY,
      {}
    );
    return cache[blueprintName];
  }

  /**
   * Save deployment values for a blueprint
   */
  private async setCachedValues(
    blueprintName: string,
    values: { environmentName: string; inputs: Record<string, string> }
  ): Promise<void> {
    const cache = this.context.workspaceState.get<DeploymentCache>(
      DEPLOYMENT_VALUES_KEY,
      {}
    );
    cache[blueprintName] = values;
    await this.context.workspaceState.update(DEPLOYMENT_VALUES_KEY, cache);
  }
  async execute(uri: vscode.Uri): Promise<void> {
    logger.info(`Deploying blueprint: ${uri.fsPath}`);

    try {
      const maybeClient = await this.getClientOrShowError();
      if (!maybeClient) {
        return;
      }
      // After null check, TypeScript knows this is ApiClient
      const client = maybeClient;

      const spaceName = await this.getSpaceNameOrShowError();
      if (!spaceName) {
        return;
      }

      // Read the blueprint file
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();

      const blueprintName = this.getBlueprintName(uri);

      logger.info(
        `Deploying blueprint "${blueprintName}" in space "${spaceName}"`
      );

      // Parse the YAML to extract inputs
      const blueprintYaml = yaml.load(content) as {
        inputs?: Record<string, { type: string; default?: string | number }>;
      };

      const inputs = blueprintYaml.inputs ?? {};

      // Convert inputs to InputDefinition format for the API
      const inputDefinitions: InputDefinition[] = Object.entries(inputs).map(
        ([name, config]) => ({
          name,
          type: config.type ?? "string",
          style: "text",
          default_value:
            config.default !== undefined ? String(config.default) : null,
          default_value_v2: null,
          has_default_value: config.default !== undefined,
          sensitive: false,
          description: null,
          allowed_values: [],
          parameter_name: null,
          pattern: null,
          validation_description: null,
          depends_on: [],
          source_name: null,
          overrides: [],
          max_size_in_mb: null,
          max_files: null,
          allowed_formats: []
        })
      );

      // Initialize input values with defaults, or use cached values from last deployment
      const cachedValues = this.getCachedValues(blueprintName);
      const inputValues: Record<string, string> = {};

      Object.entries(inputs).forEach(([name, config]) => {
        // Priority: 1. Cached value, 2. Default value, 3. Empty string
        if (cachedValues?.inputs[name]) {
          inputValues[name] = cachedValues.inputs[name];
          logger.info(
            `Using cached value for "${name}": ${cachedValues.inputs[name]}`
          );
        } else if (config.default !== undefined) {
          inputValues[name] = String(config.default);
        } else {
          inputValues[name] = "";
        }
      });

      logger.info(
        `Blueprint has ${inputDefinitions.length} input(s): ${inputDefinitions.map((i) => i.name).join(", ")}`
      );

      // Fetch allowed values for all inputs
      const allowedValuesMap = new Map<
        string,
        { value: string; display_value: string | null }[]
      >();

      if (inputDefinitions.length > 0) {
        try {
          const allowedValuesResponse: AllowedValuesResponse =
            await client.spaces.getInputAllowedValues(spaceName, {
              input_values: inputValues,
              input_definitions: inputDefinitions
            });

          // Build a map of input name to allowed values
          allowedValuesResponse.forEach((item) => {
            allowedValuesMap.set(item.name, item.allowed_values);
          });

          logger.info(
            `Fetched allowed values for ${allowedValuesResponse.length} input(s)`
          );
        } catch (error) {
          logger.error("Error fetching allowed values", error as Error);
          vscode.window.showWarningMessage(
            "Failed to fetch allowed values for some inputs. Continuing with manual input."
          );
        }
      }

      // Collect all inputs to show in the form (including auto-selected ones)
      const inputsNeedingUserInput: {
        name: string;
        config: { type: string; default?: string | number };
        allowedValues: { value: string; display_value: string | null }[];
      }[] = [];

      for (const [name, config] of Object.entries(inputs)) {
        const allowedValues = allowedValuesMap.get(name) ?? [];

        if (allowedValues.length === 1) {
          // Auto-select single allowed value but still show in form
          inputValues[name] = allowedValues[0].value;
          logger.info(
            `Auto-selected single allowed value for "${name}": ${allowedValues[0].value}`
          );
        }

        // Add ALL inputs to the form (including auto-selected ones so user can see them)
        inputsNeedingUserInput.push({ name, config, allowedValues });
      }

      // Show form-style multi-step input
      const form = new DeploymentForm(
        blueprintName,
        inputsNeedingUserInput,
        inputValues,
        cachedValues?.environmentName
      );

      const result = await form.show();

      if (!result) {
        logger.info("User cancelled deployment");
        return;
      }

      const { environmentName, inputs: formInputs } = result;

      // Update input values with form results
      Object.assign(inputValues, formInputs);

      // Cache the values for next time (persisted across sessions)
      await this.setCachedValues(blueprintName, {
        environmentName,
        inputs: inputValues
      });
      logger.info(
        `Cached deployment values for "${blueprintName}" for future use`
      );

      logger.info("=== Deploy Request ===");
      logger.info(`Environment Name: ${environmentName}`);
      logger.info(`Blueprint Name: ${blueprintName}`);
      logger.info(`Space: ${spaceName}`);
      logger.info(`Inputs: ${JSON.stringify(inputValues, null, 2)}`);
      logger.info("======================");

      // Deploy the environment with progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Deploying environment "${environmentName}"...`,
          cancellable: false
        },
        async () => {
          const result = await client.spaces.deployEnvironment(spaceName, {
            environment_name: environmentName,
            blueprint_name: blueprintName,
            inputs: inputValues,
            automation: false
          });

          logger.info("=== Deploy Successful ===");
          logger.info(`Environment ID: ${result.id}`);
          logger.info(`Ticket ID: ${result.ticket_id ?? "none"}`);
          logger.info("=========================");

          const viewEnv = await vscode.window.showInformationMessage(
            `✓ Environment "${environmentName}" deployed successfully!`,
            "View in Portal"
          );

          if (viewEnv === "View in Portal") {
            const url = await this.settingsManager.getSetting<string>("url");
            if (url) {
              // Portal URL structure: https://$server_url/$space_name/environments/$environment_id/devops
              const baseUrl = url.replace(/\/api$/, "");
              const portalUrl = `${baseUrl}/${encodeURIComponent(spaceName)}/environments/${encodeURIComponent(result.id)}/devops`;
              vscode.env.openExternal(vscode.Uri.parse(portalUrl));
            }
          }
        }
      );
    } catch (error) {
      logger.error("=== Deploy Error ===");
      logger.error("Error deploying blueprint", error as Error);

      // Log additional error details if available
      if (error && typeof error === "object") {
        logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);

        // Log axios error details if available
        if ("response" in error) {
          const axiosError = error as {
            response?: { status?: number; data?: unknown };
            config?: { url?: string; method?: string };
          };
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
      logger.error("====================");

      vscode.window.showErrorMessage(
        `Failed to deploy blueprint: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
