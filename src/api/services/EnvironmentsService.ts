import { Service } from "./Service";
import type { EnvironmentListResponse } from "./types";
import { logger } from "../../utils/Logger";

export class EnvironmentsService extends Service {
  protected readonly basePath = "/api";

  /**
   * Fetches active environments for a specific blueprint
   *
   * Uses multiple status filters instead of active_only parameter due to API bug.
   * Active statuses include: Launching, Active, Active With Error, Terminating,
   * Terminate Failed, Updating, Importing, Releasing, N/A, In Progress
   *
   * @param blueprintName The blueprint name (without file extension)
   * @returns Promise<EnvironmentListResponse> Environment list with metadata
   */
  async getActiveEnvironments(
    blueprintName: string
  ): Promise<EnvironmentListResponse> {
    const baseUrl = this.getUrl("operation_hub");

    // Active environment statuses (excludes "Ended" and other terminated states)
    const activeStatuses = [
      "Launching",
      "Active",
      "Active With Error",
      "Terminating",
      "Terminate Failed",
      "Updating",
      "Importing",
      "Releasing",
      "N/A",
      "In Progress"
    ];

    // Construct query parameters - used for both API call and logging
    const queryParams = new URLSearchParams();
    activeStatuses.forEach((status) => queryParams.append("status", status));
    queryParams.append("blueprint_name", blueprintName);

    const fullUrl = `${baseUrl}?${queryParams.toString()}`;

    logger.info("=== Active Environments API Request ===");
    logger.info(`Blueprint Name: ${blueprintName}`);
    logger.info(`Active Statuses: ${JSON.stringify(activeStatuses, null, 2)}`);
    logger.info(`Full URL: ${fullUrl}`);
    logger.info("=======================================");

    try {
      const response =
        await this.client.client.get<EnvironmentListResponse>(fullUrl);

      logger.info("=== Active Environments API Response ===");
      logger.info(`Status: ${response.status}`);
      logger.info(
        `Environments count: ${response.data.environment_list?.length ?? 0}`
      );
      logger.info(
        `Active environments: ${response.data.active_environments ?? 0}`
      );
      logger.info("========================================");

      return response.data;
    } catch (error) {
      logger.error("=== Active Environments API Error ===");
      logger.error(`Error fetching active environments for: ${blueprintName}`);
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
      logger.error("======================================");
      throw error;
    }
  }
}
