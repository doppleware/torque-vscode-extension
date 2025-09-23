import type { ApiClient } from "../ApiClient";

export abstract class Service {
  protected abstract readonly basePath: string;

  constructor(protected client: ApiClient) {}

  protected getUrl(path: string): string {
    return `${this.basePath}/${path}`;
  }
}
