import { Service } from "./Service";
import type { Space, Repository } from "./types";

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
}
