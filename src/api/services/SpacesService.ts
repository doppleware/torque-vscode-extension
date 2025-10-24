import { Service } from "./Service";
import type {
  Space,
  Repository,
  IacAssetsResponse,
  BlueprintValidationRequest,
  BlueprintValidationResponse,
  CatalogAssetResponse,
  IntrospectionResponse,
  WorkflowsResponse,
  AllowedValuesRequest,
  AllowedValuesResponse,
  DeployEnvironmentRequest,
  DeployEnvironmentResponse
} from "./types";
import { logger } from "../../utils/Logger";

export class SpacesService extends Service {
  protected readonly basePath = "/api";

  /**
   * Fetches the list of available Torque spaces
   *
   * @returns Promise<Space[]> Array of space objects
   */
  async getSpaces(): Promise<Space[]> {
    const response = await this.client.client.get<Space[]>(
      this.getUrl("spaces")
    );
    return response.data;
  }

  /**
   * Fetches the list of repositories for a specific space
   *
   * @param spaceName The name of the space
   * @returns Promise<Repository[]> Array of repository objects
   */
  async getRepositories(spaceName: string): Promise<Repository[]> {
    const response = await this.client.client.get<Repository[]>(
      this.getUrl(`spaces/${encodeURIComponent(spaceName)}/repositories`)
    );
    return response.data;
  }

  /**
   * Fetches the list of IAC assets (grains) for a specific space
   *
   * @param spaceName The name of the space
   * @returns Promise<IacAssetsResponse> Response containing IAC assets and paging info
   */
  async getIacAssets(spaceName: string): Promise<IacAssetsResponse> {
    const response = await this.client.client.get<IacAssetsResponse>(
      this.getUrl(`spaces/${encodeURIComponent(spaceName)}/iac-assets`)
    );
    return response.data;
  }

  /**
   * Validates a blueprint in a specific space
   *
   * @param spaceName The name of the space
   * @param request The validation request containing blueprint name and content in base64
   * @returns Promise<BlueprintValidationResponse> Validation result with errors and warnings
   */
  async validateBlueprint(
    spaceName: string,
    request: BlueprintValidationRequest
  ): Promise<BlueprintValidationResponse> {
    const response = await this.client.client.post<BlueprintValidationResponse>(
      this.getUrl(
        `spaces/${encodeURIComponent(spaceName)}/validations/blueprints`
      ),
      request
    );
    return response.data;
  }

  /**
   * Syncs a blueprint from SCM (imports the latest version from source control)
   *
   * @param spaceName The name of the space
   * @param repositoryName The name of the repository (e.g., "torque_iac")
   * @param blueprintName The name of the blueprint (without extension)
   * @returns Promise<void>
   */
  async syncBlueprintFromScm(
    spaceName: string,
    repositoryName: string,
    blueprintName: string
  ): Promise<void> {
    await this.client.client.post(
      this.getUrl(
        `spaces/${encodeURIComponent(spaceName)}/repositories/${encodeURIComponent(repositoryName)}/blueprints/${encodeURIComponent(blueprintName)}/update`
      )
    );
  }

  /**
   * Gets detailed information about an IAC asset from the catalog
   *
   * @param spaceName The name of the space
   * @param iacAssetName The unique name of the IAC asset
   * @param repositoryName The repository name (e.g., "qtorque")
   * @returns Promise<CatalogAssetResponse> Detailed asset information including inputs
   */
  async getCatalogAsset(
    spaceName: string,
    iacAssetName: string,
    repositoryName: string
  ): Promise<CatalogAssetResponse> {
    const url = this.getUrl(
      `spaces/${encodeURIComponent(spaceName)}/catalog/${encodeURIComponent(iacAssetName)}`
    );

    logger.info("=== Catalog API Request ===");
    logger.info(`URL: ${url}`);
    logger.info(`Space Name (encoded): ${encodeURIComponent(spaceName)}`);
    logger.info(
      `IAC Asset Name (encoded): ${encodeURIComponent(iacAssetName)}`
    );
    logger.info(`Query Parameters: { repository_name: "${repositoryName}" }`);
    logger.info(
      `Full URL with params: ${url}?repository_name=${repositoryName}`
    );
    logger.info("===========================");

    try {
      const response = await this.client.client.get<CatalogAssetResponse>(url, {
        params: {
          repository_name: repositoryName
        }
      });

      logger.info("=== Catalog API Response ===");
      logger.info(`Status: ${response.status}`);
      logger.info(`Response has details: ${!!response.data.details}`);
      logger.info(
        `Inputs count: ${response.data.details?.inputs?.length ?? 0}`
      );
      logger.info("============================");

      return response.data;
    } catch (error) {
      logger.error("=== Catalog API Error ===");
      logger.error(`Error fetching catalog asset: ${iacAssetName}`);
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: unknown };
        };
        logger.error(
          `HTTP Status: ${axiosError.response?.status ?? "unknown"}`
        );
        logger.error(
          `Response Data: ${JSON.stringify(axiosError.response?.data ?? {}, null, 2)}`
        );
      }
      logger.error("=========================");
      throw error;
    }
  }

  /**
   * Gets the introspection data (resources) for a specific grain/asset in an environment
   *
   * @param spaceName The name of the space
   * @param environmentId The ID of the environment
   * @param assetName The name of the grain/asset to introspect
   * @returns Promise<IntrospectionResponse> The introspection data containing resources
   */
  async getEnvironmentIntrospection(
    spaceName: string,
    environmentId: string,
    assetName: string
  ): Promise<IntrospectionResponse> {
    const url = this.getUrl(
      `spaces/${encodeURIComponent(spaceName)}/environments/${encodeURIComponent(environmentId)}/introspection/${encodeURIComponent(assetName)}`
    );

    logger.info("=== Introspection API Request ===");
    logger.info(`URL: ${url}`);
    logger.info(`Space Name: ${spaceName}`);
    logger.info(`Environment ID: ${environmentId}`);
    logger.info(`Asset Name: ${assetName}`);
    logger.info("=================================");

    try {
      const response = await this.client.client.get<IntrospectionResponse>(url);

      logger.info("=== Introspection API Response ===");
      logger.info(`Status: ${response.status}`);
      logger.info(`Resources count: ${response.data.resources?.length ?? 0}`);
      logger.info("===================================");

      return response.data;
    } catch (error) {
      logger.error("=== Introspection API Error ===");
      logger.error(`Error fetching introspection for asset: ${assetName}`);
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: unknown };
        };
        logger.error(
          `HTTP Status: ${axiosError.response?.status ?? "unknown"}`
        );
        logger.error(
          `Response Data: ${JSON.stringify(axiosError.response?.data ?? {}, null, 2)}`
        );
      }
      logger.error("================================");
      throw error;
    }
  }

  /**
   * Fetches workflows for a specific resource in an environment
   *
   * @param spaceName The space name
   * @param environmentId The environment ID
   * @param grainPath The grain path
   * @param resourceId The resource identifier (e.g., Pod.hello-world-chart-a4d38-c49d66fb7-x7lrt)
   * @returns Promise<WorkflowsResponse> Workflows available for the resource
   */
  async getResourceWorkflows(
    spaceName: string,
    environmentId: string,
    grainPath: string,
    resourceId: string
  ): Promise<WorkflowsResponse> {
    const url = `/api/spaces/${encodeURIComponent(spaceName)}/environments/${encodeURIComponent(environmentId)}/workflows_v2`;

    logger.info("=== Resource Workflows API Request ===");
    logger.info(`URL: ${url}`);
    logger.info(`Space Name: ${spaceName}`);
    logger.info(`Environment ID: ${environmentId}`);
    logger.info(`Grain Path: ${grainPath}`);
    logger.info(`Resource ID: ${resourceId}`);
    logger.info("======================================");

    try {
      const response = await this.client.client.get<WorkflowsResponse>(url, {
        params: {
          grain_path: grainPath,
          resource_id: resourceId
        }
      });

      logger.info("=== Resource Workflows API Response ===");
      logger.info(`Status: ${response.status}`);
      logger.info(
        `Workflows count: ${response.data.instantiations?.length ?? 0}`
      );
      logger.info("=======================================");

      return response.data;
    } catch (error) {
      logger.error("=== Resource Workflows API Error ===");
      logger.error(
        `Error fetching workflows for resource: ${resourceId} in grain: ${grainPath}`
      );
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: unknown };
        };
        logger.error(
          `HTTP Status: ${axiosError.response?.status ?? "unknown"}`
        );
        logger.error(
          `Response Data: ${JSON.stringify(axiosError.response?.data ?? {}, null, 2)}`
        );
      }
      logger.error("====================================");
      throw error;
    }
  }

  /**
   * Get allowed values for blueprint inputs
   *
   * @param spaceName The space name
   * @param request The allowed values request containing current input values and input definitions
   * @returns Promise<AllowedValuesResponse> Allowed values for each input
   */
  async getInputAllowedValues(
    spaceName: string,
    request: AllowedValuesRequest
  ): Promise<AllowedValuesResponse> {
    const url = this.getUrl(
      `spaces/${encodeURIComponent(spaceName)}/catalog/inputs_allowed_values`
    );

    logger.info("=== Input Allowed Values API Request ===");
    logger.info(`URL: ${url}`);
    logger.info(`Space: ${spaceName}`);
    logger.info(`Request Payload: ${JSON.stringify(request, null, 2)}`);
    logger.info("=========================================");

    try {
      const response = await this.client.client.post<AllowedValuesResponse>(
        url,
        request
      );

      logger.info("=== Input Allowed Values API Response ===");
      logger.info(`Status: ${response.status}`);
      logger.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
      logger.info("==========================================");

      return response.data;
    } catch (error) {
      logger.error("=== Input Allowed Values API Error ===");
      logger.error("Error fetching input allowed values");
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: unknown };
        };
        logger.error(
          `HTTP Status: ${axiosError.response?.status ?? "unknown"}`
        );
        logger.error(
          `Response Data: ${JSON.stringify(axiosError.response?.data ?? {}, null, 2)}`
        );
      }
      logger.error("=======================================");
      throw error;
    }
  }

  /**
   * Deploy a blueprint environment
   *
   * @param spaceName The space name
   * @param request The deploy environment request containing environment details and inputs
   * @returns Promise<DeployEnvironmentResponse> Deployed environment information
   */
  async deployEnvironment(
    spaceName: string,
    request: DeployEnvironmentRequest
  ): Promise<DeployEnvironmentResponse> {
    const url = this.getUrl(
      `spaces/${encodeURIComponent(spaceName)}/environments`
    );

    logger.info("=== Deploy Environment API Request ===");
    logger.info(`URL: ${url}`);
    logger.info(`Space: ${spaceName}`);
    logger.info(`Request Payload: ${JSON.stringify(request, null, 2)}`);
    logger.info("=======================================");

    try {
      const response = await this.client.client.post<DeployEnvironmentResponse>(
        url,
        request
      );

      logger.info("=== Deploy Environment API Response ===");
      logger.info(`Status: ${response.status}`);
      logger.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
      logger.info("========================================");

      return response.data;
    } catch (error) {
      logger.error("=== Deploy Environment API Error ===");
      logger.error("Error deploying environment");
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: unknown };
        };
        logger.error(
          `HTTP Status: ${axiosError.response?.status ?? "unknown"}`
        );
        logger.error(
          `Response Data: ${JSON.stringify(axiosError.response?.data ?? {}, null, 2)}`
        );
      }
      logger.error("====================================");
      throw error;
    }
  }
}
