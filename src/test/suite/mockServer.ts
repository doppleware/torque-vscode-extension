import * as http from "http";
import { URL } from "url";

export interface MockServerOptions {
  port?: number;
  requireAuth?: boolean;
}

export interface EnvironmentRequest {
  spaceName: string;
  environmentId: string;
}

export class MockTorqueServer {
  private server: http.Server | null = null;
  private port = 0;
  private requestLog: EnvironmentRequest[] = [];
  private authRequired: boolean;

  constructor(options: MockServerOptions = {}) {
    this.authRequired = options.requireAuth ?? true;
  }

  async start(port?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", reject);

      this.server.listen(port || 0, () => {
        const address = this.server?.address();
        if (address && typeof address !== "string") {
          this.port = address.port;
          resolve(this.port);
        } else {
          reject(new Error("Failed to get server port"));
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  getRequestLog(): EnvironmentRequest[] {
    return [...this.requestLog];
  }

  clearRequestLog(): void {
    this.requestLog = [];
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Check authentication if required
    if (this.authRequired) {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: "Authorization header required" }));
        return;
      }
    }

    const url = new URL(req.url || "", `http://localhost:${this.port}`);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Handle GET /api/health (for authentication check)
    if (
      req.method === "GET" &&
      pathParts.length === 2 &&
      pathParts[0] === "api" &&
      pathParts[1] === "health"
    ) {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Handle GET /api/spaces/{spaceName}/environments/{environmentId}
    if (
      req.method === "GET" &&
      pathParts.length === 5 &&
      pathParts[0] === "api" &&
      pathParts[1] === "spaces" &&
      pathParts[3] === "environments"
    ) {
      const spaceName = decodeURIComponent(pathParts[2]);
      const environmentId = decodeURIComponent(pathParts[4]);

      // Log the request (only log environment details requests, not health checks)
      this.requestLog.push({ spaceName, environmentId });

      // Generate mock response
      const mockResponse = this.generateMockEnvironmentDetails(
        spaceName,
        environmentId
      );

      res.writeHead(200);
      res.end(JSON.stringify(mockResponse));
      return;
    }

    // Handle unknown endpoints
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Endpoint not found" }));
  }

  private generateMockEnvironmentDetails(
    spaceName: string,
    environmentId: string
  ): any {
    const randomId = Math.random().toString(36).substring(7);
    const randomCost = Math.floor(Math.random() * 1000) + 50;

    return {
      owner: {
        first_name: "Test",
        last_name: "User",
        timezone: "UTC",
        email: "test@example.com",
        join_date: "2024-01-01T00:00:00.000Z",
        display_first_name: "Test",
        display_last_name: "User"
      },
      initiator: null,
      collaborators_info: {
        collaborators: [],
        collaborators_groups: [],
        all_space_members: false
      },
      is_workflow: false,
      is_published: true,
      details: {
        state: { status: "Active" },
        id: environmentId,
        definition: { name: `Environment ${environmentId}` },
        computed_status: { health: "Healthy" },
        estimated_launch_duration_in_seconds: 300
      },
      cost: {
        sum: randomCost,
        last_update: new Date().toISOString(),
        final: false,
        currency: "USD",
        incomplete: false
      },
      read_only: false,
      last_used: new Date().toISOString(),
      annotations: [
        {
          key: "environment",
          value: "test",
          color: "FrogGreen",
          filterable: true,
          last_updated: new Date().toISOString()
        }
      ],
      entity_metadata: {
        type: "Environment",
        workflow_instantiation_name: null
      },
      has_incoming_connections: false,
      connections: {
        outgoing_connections: [],
        outgoing_connections_count: 0,
        incoming_connections: [],
        incoming_connections_count: 0
      },
      incoming_connections_count: 0,
      termination_protection_enabled: false,
      reserved_resources: [
        {
          id: `resource-${randomId}`,
          name: `Test Resource ${randomId}`,
          type: "compute",
          excluded_from_reserving: false,
          excluded_from_reserving_reason: null
        }
      ],
      eac: {
        url: null,
        status: "Enabled",
        eac_synced: true,
        registered: true,
        enabled: true,
        errors: [],
        validation_errors: []
      },
      inputs: {},
      inputs_v2: []
    };
  }
}
