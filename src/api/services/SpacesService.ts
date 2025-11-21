import { logger } from "../../utils/Logger";
import { Service } from "./Service";
import type {
  AllowedValuesRequest,
  AllowedValuesResponse,
  BlueprintValidationRequest,
  BlueprintValidationResponse,
  CatalogAssetResponse,
  DeployEnvironmentRequest,
  DeployEnvironmentResponse,
  IacAssetsResponse,
  IntrospectionResponse,
  Repository,
  Space,
  WorkflowsResponse
} from "./types";

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
   * Fetches a single page of IAC assets (grains) for a specific space
   *
   * @param spaceName The name of the space
   * @param skip Number of items to skip (offset for pagination)
   * @param take Number of items to take (page size, default 100)
   * @returns Promise<IacAssetsResponse> Response containing IAC assets and paging info
   */
  async getIacAssets(
    spaceName: string,
    skip = 0,
    take = 100
  ): Promise<IacAssetsResponse> {
    const baseUrl = this.getUrl(
      `spaces/${encodeURIComponent(spaceName)}/iac-assets`
    );

    // Construct query parameters using skip/take pagination
    const queryParams = new URLSearchParams();
    queryParams.append("skip", skip.toString());
    queryParams.append("take", take.toString());

    const fullUrl = `${baseUrl}?${queryParams.toString()}`;

    logger.info(`=== IAC Assets Request ===`);
    logger.info(`URL: ${fullUrl}`);
    logger.info(`Space: ${spaceName}`);
    logger.info(`Skip: ${skip} items`);
    logger.info(`Take: ${take} items`);
    logger.info(`========================`);

    const response = await this.client.client.get<IacAssetsResponse>(fullUrl);

    logger.info(`=== IAC Assets Response (skip=${skip}, take=${take}) ===`);
    logger.info(`Assets in response: ${response.data.iac_assets.length}`);
    logger.info(`Paging info:`, response.data.paging_info);
    if (response.data.iac_assets.length > 0) {
      logger.info(`First asset: ${response.data.iac_assets[0].name}`);
      logger.info(
        `Last asset: ${response.data.iac_assets[response.data.iac_assets.length - 1].name}`
      );
    }
    logger.info(`=====================================`);

    return response.data;
  }

  /**
   * Fetches all IAC assets (grains) for a specific space across all pages
   * Loads pages asynchronously for better performance
   *
   * @param spaceName The name of the space
   * @returns Promise<IacAssetsResponse> Response containing all IAC assets and paging info
   */
  async getAllIacAssets(spaceName: string): Promise<IacAssetsResponse> {
    logger.info(`=== getAllIacAssets START ===`);
    logger.info(`Space: ${spaceName}`);

    const pageSize = 100;

    // Fetch first page (skip=0, take=100) to get total count
    const firstPage = await this.getIacAssets(spaceName, 0, pageSize);

    logger.info(
      `First page received: ${firstPage.iac_assets.length} assets, ${firstPage.paging_info.total_pages} total pages, ${firstPage.paging_info.full_count} full count`
    );

    const totalCount = firstPage.paging_info.full_count;
    const fetchedCount = firstPage.iac_assets.length;

    // If we got everything in the first request, return it
    if (fetchedCount >= totalCount) {
      logger.info(
        `All assets fetched in first page, returning ${fetchedCount} assets`
      );
      logger.info(`=== getAllIacAssets END ===`);
      return firstPage;
    }

    // Calculate how many more requests we need
    const remainingCount = totalCount - fetchedCount;
    const additionalPages = Math.ceil(remainingCount / pageSize);

    // Generate skip values for remaining pages (100, 200, 300, ...)
    const skipValues = Array.from(
      { length: additionalPages },
      (_, i) => (i + 1) * pageSize
    );

    logger.info(
      `Fetching ${additionalPages} additional page(s) with skip values: [${skipValues.join(", ")}]`
    );

    const remainingPagesData = await Promise.all(
      skipValues.map((skip) => this.getIacAssets(spaceName, skip, pageSize))
    );

    logger.info(`All additional pages received`);
    remainingPagesData.forEach((pageData, index) => {
      logger.info(
        `  Skip ${skipValues[index]}: ${pageData.iac_assets.length} assets`
      );
    });

    // Combine all assets
    const allAssets = [
      ...firstPage.iac_assets,
      ...remainingPagesData.flatMap((page) => page.iac_assets)
    ];

    logger.info(`Combined all pages: ${allAssets.length} total assets`);
    logger.info(
      `Assets breakdown: First page (${firstPage.iac_assets.length}) + Additional pages (${remainingPagesData.flatMap((p) => p.iac_assets).length})`
    );

    // Check for duplicates
    const uniqueNames = new Set(allAssets.map((a) => a.name));
    logger.info(
      `Unique asset names: ${uniqueNames.size} (duplicates: ${allAssets.length - uniqueNames.size})`
    );

    logger.info(`=== getAllIacAssets END ===`);

    return {
      iac_assets: allAssets,
      paging_info: {
        full_count: firstPage.paging_info.full_count,
        requested_page: firstPage.paging_info.requested_page,
        total_pages: firstPage.paging_info.total_pages
      }
    };
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
