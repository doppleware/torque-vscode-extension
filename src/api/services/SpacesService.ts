import { Service } from "./Service";
import type { Space, Repository, IacAssetsResponse } from "./types";

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
}
