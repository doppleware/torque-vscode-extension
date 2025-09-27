import { type Key, pathToRegexp } from "path-to-regexp";
import vscode from "vscode";

export type RouteParams = Record<string, string>;

export type QueryParams = Record<string, string | undefined>;

export type RouteHandler = (
  params: RouteParams,
  query: QueryParams,
  uri: vscode.Uri
) => Promise<void>;

interface Route {
  pattern: string;
  regexp: RegExp;
  keys: Key[];
  handler: RouteHandler;
}

export class UriRouter {
  private routes: Route[] = [];

  route(pattern: string, handler: RouteHandler) {
    const { regexp, keys } = pathToRegexp(pattern);

    this.routes.push({
      pattern,
      regexp,
      keys,
      handler
    });

    // Debug logging
    // eslint-disable-next-line no-console
    console.log(`[UriRouter] Registered route: ${pattern}`);
  }

  async handleUri(uri: vscode.Uri): Promise<boolean> {
    const queryParams = this.parseQueryParams(uri.query);

    // eslint-disable-next-line no-console
    console.log(
      `[UriRouter] Handling URI path: ${uri.path}, available routes: ${this.routes.length}`
    );
    // eslint-disable-next-line no-console
    console.log(
      `[UriRouter] Available route patterns: ${this.routes.map((r) => r.pattern).join(", ")}`
    );

    // Try to match path-based routes
    for (const route of this.routes) {
      const match = route.regexp.exec(uri.path);
      // eslint-disable-next-line no-console
      console.log(
        `[UriRouter] Testing route ${route.pattern} against ${uri.path}: ${match ? "MATCH" : "no match"}`
      );

      if (match) {
        try {
          // Extract parameters
          const params: RouteParams = {};
          route.keys.forEach((key, index) => {
            if (match[index + 1] !== undefined) {
              params[key.name] = decodeURIComponent(match[index + 1]);
            }
          });

          await route.handler(params, queryParams, uri);
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to handle request: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          return false;
        }
      }
    }

    return false;
  }

  private parseQueryParams(query: string): QueryParams {
    const params: QueryParams = {};
    const urlParams = new URLSearchParams(query);

    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }

    return params;
  }
}
