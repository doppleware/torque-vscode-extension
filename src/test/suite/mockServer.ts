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

export interface IntrospectionRequest {
  spaceName: string;
  environmentId: string;
  assetName: string;
}

export class MockTorqueServer {
  private server: http.Server | null = null;
  private port = 0;
  private requestLog: EnvironmentRequest[] = [];
  private introspectionRequestLog: IntrospectionRequest[] = [];
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

  getIntrospectionRequestLog(): IntrospectionRequest[] {
    return [...this.introspectionRequestLog];
  }

  clearRequestLog(): void {
    this.requestLog = [];
  }

  clearIntrospectionRequestLog(): void {
    this.introspectionRequestLog = [];
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

    // Handle GET /api/spaces (list spaces)
    if (
      req.method === "GET" &&
      pathParts.length === 2 &&
      pathParts[0] === "api" &&
      pathParts[1] === "spaces"
    ) {
      res.writeHead(200);
      res.end(
        JSON.stringify([
          {
            name: "test-space",
            description: "Test space for integration tests"
          },
          { name: "production", description: "Production space" }
        ])
      );
      return;
    }

    // Handle GET /api/spaces/{spaceName}/environments/{environmentId}/introspection/{assetName}
    if (
      req.method === "GET" &&
      pathParts.length === 7 &&
      pathParts[0] === "api" &&
      pathParts[1] === "spaces" &&
      pathParts[3] === "environments" &&
      pathParts[5] === "introspection"
    ) {
      const spaceName = decodeURIComponent(pathParts[2]);
      const environmentId = decodeURIComponent(pathParts[4]);
      const assetName = decodeURIComponent(pathParts[6]);

      // Log the introspection request
      this.introspectionRequestLog.push({
        spaceName,
        environmentId,
        assetName
      });

      // Generate mock introspection response
      const mockResponse = this.generateMockIntrospectionData(assetName);

      res.writeHead(200);
      res.end(JSON.stringify(mockResponse));
      return;
    }

    // Handle GET /api/spaces/{spaceName}/environments/{environmentId}/workflows_v2
    if (
      req.method === "GET" &&
      pathParts.length === 6 &&
      pathParts[0] === "api" &&
      pathParts[1] === "spaces" &&
      pathParts[3] === "environments" &&
      pathParts[5] === "workflows_v2"
    ) {
      const spaceName = decodeURIComponent(pathParts[2]);
      const environmentId = decodeURIComponent(pathParts[4]);

      // Parse query parameters
      const url = new URL(req.url || "", `http://localhost:${this.port}`);
      const grainPath = url.searchParams.get("grain_path") || "";
      const resourceId = url.searchParams.get("resource_id") || "";

      // Generate mock workflows response
      const mockResponse = this.generateMockWorkflowsData(resourceId);

      res.writeHead(200);
      res.end(JSON.stringify(mockResponse));
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
        state: {
          status: "Active",
          grains: [
            {
              name: "test-grain-1",
              path: "infrastructure/terraform",
              kind: "terraform",
              execution_host: "aws-agent",
              inputs: [
                {
                  name: "instance_type",
                  value: "t3.medium"
                },
                {
                  name: "region",
                  value: "us-east-1"
                }
              ],
              state: {
                current_state: "Deployed",
                stages: [
                  {
                    activities: [
                      {
                        id: "activity-1-prepare",
                        name: "Prepare",
                        status: "Done"
                      },
                      {
                        id: "activity-1-apply",
                        name: "Apply",
                        status: "Done"
                      }
                    ]
                  }
                ]
              }
            },
            {
              name: "test-grain-2",
              path: "charts/hello-world",
              kind: "helm",
              execution_host: "k8s-agent",
              inputs: [
                {
                  name: "replicaCount",
                  value: "1"
                },
                {
                  name: "target-namespace",
                  value: "vido-sb"
                }
              ],
              state: {
                current_state: "Deployed",
                stages: [
                  {
                    activities: [
                      {
                        id: "activity-2-prepare",
                        name: "Prepare",
                        status: "Done"
                      },
                      {
                        id: "activity-2-install",
                        name: "Install",
                        status: "Done"
                      }
                    ]
                  }
                ]
              }
            }
          ]
        },
        id: environmentId,
        definition: {
          metadata: {
            name: `Environment ${environmentId}`,
            space_name: spaceName
          },
          inputs: [
            {
              name: "test-input",
              value: "test-value"
            }
          ],
          outputs: []
        },
        computed_status: "Active",
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

  private generateMockIntrospectionData(assetName: string): any {
    // Generate mock resources based on asset name
    const resources = [
      {
        name: `${assetName}-resource-1`,
        type: "aws_instance",
        dependency_identifier: `aws_instance.${assetName}-resource-1`,
        attributes: {
          instance_type: "t3.medium",
          ami: "ami-12345678",
          availability_zone: "us-east-1a"
        },
        tags: {
          Name: `${assetName}-instance`,
          Environment: "test",
          ManagedBy: "Torque"
        },
        depends_on: []
      },
      {
        name: `${assetName}-resource-2`,
        type: "aws_security_group",
        dependency_identifier: `aws_security_group.${assetName}-resource-2`,
        attributes: {
          vpc_id: "vpc-12345678",
          description: "Security group for test"
        },
        tags: {
          Name: `${assetName}-sg`,
          Environment: "test"
        },
        depends_on: [`aws_instance.${assetName}-resource-1`]
      }
    ];

    return {
      resources,
      errors: []
    };
  }

  private generateMockWorkflowsData(resourceId: string): any {
    // Generate mock workflows based on resource ID
    return {
      instantiations: [
        {
          id: "workflow-1-id",
          name: "kubectl_logs__instantiation__20251023_160510_199",
          scope: "env_resource",
          inputs: [
            {
              name: "target-namespace",
              value: null,
              type: "string",
              allowed_values: []
            }
          ],
          env_references: [],
          blueprint_name: "kubectl_logs",
          blueprint_store: "torque_iac",
          triggers: [
            {
              next_occurrence: null,
              event: [],
              cron: null,
              type: "manual",
              overridable: false,
              pauseUntil: null
            }
          ],
          enabled: true
        },
        {
          id: "workflow-2-id",
          name: "restart_pod__instantiation__20251023_160515_200",
          scope: "env_resource",
          inputs: [
            {
              name: "force",
              value: null,
              type: "boolean",
              allowed_values: []
            }
          ],
          env_references: [],
          blueprint_name: "restart_pod",
          blueprint_store: "torque_iac",
          triggers: [
            {
              next_occurrence: null,
              event: [],
              cron: null,
              type: "manual",
              overridable: false,
              pauseUntil: null
            }
          ],
          enabled: true
        }
      ]
    };
  }
}
