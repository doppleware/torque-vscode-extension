import { Service } from "./Service";
import type { EnvironmentListResponse } from "./types";

export class EnvironmentsService extends Service {
  protected readonly basePath = "/api";

  /**
   * Fetches active environments for a specific blueprint
   *
   * @param blueprintName The blueprint name (without file extension)
   * @returns Promise<EnvironmentListResponse> Environment list with metadata
   */
  async getActiveEnvironments(
    blueprintName: string
  ): Promise<EnvironmentListResponse> {
    const response = await this.client.client.get<EnvironmentListResponse>(
      this.getUrl("operation_hub"),
      {
        params: {
          active_only: true,
          blueprint_name: blueprintName
        }
      }
    );
    return response.data;
  }
}
