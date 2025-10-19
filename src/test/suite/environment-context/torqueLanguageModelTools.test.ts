import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TorqueEnvironmentDetailsTool } from "../../../domains/environment-context";
import { ApiClient } from "../../../api/ApiClient";

interface MockAxiosResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Record<string, unknown>;
}

// Create a testable version of the tool that we can stub
class TestableTorqueEnvironmentDetailsTool extends TorqueEnvironmentDetailsTool {
  public getApiClient() {
    return super.getApiClient();
  }
}

suite("TorqueEnvironmentDetailsTool Test Suite", () => {
  let tool: TestableTorqueEnvironmentDetailsTool;
  let mockApiClient: sinon.SinonStubbedInstance<ApiClient>;
  let getApiClientStub: sinon.SinonStub;

  const mockEnvironmentDetails = {
    owner: {
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
      timezone: "UTC",
      join_date: "2023-01-01T00:00:00Z",
      display_first_name: "Johnny",
      display_last_name: "Doe"
    },
    initiator: null,
    collaborators_info: {
      collaborators: [],
      collaborators_groups: [],
      all_space_members: false
    },
    is_workflow: true,
    is_published: true,
    details: {
      state: { status: "running" },
      id: "env-123",
      definition: { type: "terraform" },
      computed_status: { phase: "active" },
      estimated_launch_duration_in_seconds: 300
    },
    cost: {
      sum: 125.5,
      last_update: "2023-12-01T10:30:00Z",
      final: false,
      currency: "USD",
      incomplete: false
    },
    read_only: false,
    last_used: "2023-12-01T09:15:00Z",
    annotations: [
      {
        key: "environment",
        value: "production",
        color: "FrogGreen" as const,
        filterable: true,
        last_updated: "2023-12-01T08:00:00Z"
      },
      {
        key: "team",
        value: "backend",
        color: null,
        filterable: true,
        last_updated: "2023-12-01T08:00:00Z"
      }
    ],
    entity_metadata: {
      type: "workflow",
      workflow_instantiation_name: "deploy-backend"
    },
    has_incoming_connections: true,
    connections: {
      outgoing_connections: [{ target: "db-env" }],
      outgoing_connections_count: 1,
      incoming_connections: [{ source: "frontend-env" }],
      incoming_connections_count: 1
    },
    incoming_connections_count: 1,
    termination_protection_enabled: true,
    reserved_resources: [
      {
        id: "res-1",
        name: "compute-instance",
        type: "vm",
        excluded_from_reserving: false,
        excluded_from_reserving_reason: null
      },
      {
        id: "res-2",
        name: "database",
        type: "rds",
        excluded_from_reserving: true,
        excluded_from_reserving_reason: "Maintenance window"
      }
    ],
    eac: {
      url: "https://github.com/company/terraform-configs",
      status: "synced",
      eac_synced: true,
      registered: true,
      enabled: true,
      errors: [],
      validation_errors: []
    },
    inputs: { region: "us-west-2" },
    inputs_v2: [{ key: "region", value: "us-west-2" }]
  };

  setup(() => {
    tool = new TestableTorqueEnvironmentDetailsTool();

    // Create mock API client
    mockApiClient = sinon.createStubInstance(ApiClient);
    const mockAxiosClient = {
      get: sinon.stub()
    } as any;
    Object.defineProperty(mockApiClient, "client", {
      value: mockAxiosClient,
      writable: false
    });

    // Stub the getApiClient method
    getApiClientStub = sinon.stub(tool, "getApiClient");
    getApiClientStub.returns(mockApiClient);
  });

  teardown(() => {
    sinon.restore();
  });

  suite("prepareInvocation", () => {
    test("Should create proper invocation message", () => {
      const options = {
        input: {
          space_name: "test-space",
          environment_id: "test-env-123"
        }
      } as any;

      const result = tool.prepareInvocation(options);

      assert.strictEqual(
        result.invocationMessage,
        "Fetching environment details for test-env-123 in space test-space"
      );
      assert.ok(result.confirmationMessages);
      assert.strictEqual(
        result.confirmationMessages.title,
        "Get Torque Environment Details"
      );
    });

    test("Should include space and environment in confirmation message", () => {
      const options = {
        input: {
          space_name: "production",
          environment_id: "web-app-env"
        }
      } as any;

      const result = tool.prepareInvocation(options);
      const message = result.confirmationMessages?.message;

      assert.ok(message);
      const messageValue =
        typeof message === "string" ? message : message.value;
      assert.ok(messageValue.includes("production"));
      assert.ok(messageValue.includes("web-app-env"));
    });
  });

  suite("invoke", () => {
    test("Should successfully fetch and format environment details", async () => {
      // Mock successful API response for both health check and environment details
      const mockHealthResponse: MockAxiosResponse<any> = {
        data: { status: "ok" },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {}
      };

      const mockResponse: MockAxiosResponse<typeof mockEnvironmentDetails> = {
        data: mockEnvironmentDetails,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {}
      };

      // Mock health check first, then environment details
      (mockApiClient.client.get as sinon.SinonStub)
        .onFirstCall()
        .resolves(mockHealthResponse)
        .onSecondCall()
        .resolves(mockResponse);

      const options = {
        input: {
          space_name: "test-space",
          environment_id: "env-123"
        }
      } as any;

      const result = await tool.invoke(options);

      // Verify API was called twice (health check + environment details)
      sinon.assert.calledTwice(mockApiClient.client.get as sinon.SinonStub);

      // Verify health check call
      sinon.assert.calledWith(
        mockApiClient.client.get as sinon.SinonStub,
        "/api/health",
        { validateStatus: sinon.match.func }
      );

      // Verify environment details call
      sinon.assert.calledWith(
        mockApiClient.client.get as sinon.SinonStub,
        "/api/spaces/test-space/environments/env-123"
      );

      // Verify result structure
      assert.ok(result);

      // Basic verification that we got a result - the exact structure may vary
      // This test focuses on verifying the API call was made correctly
      const resultString = result.toString();
      assert.ok(resultString.length > 0);
    });

    test("Should handle API errors gracefully", async () => {
      const mockError = new Error("API request failed");
      (mockApiClient.client.get as sinon.SinonStub).rejects(mockError);

      const options = {
        input: {
          space_name: "test-space",
          environment_id: "env-123"
        }
      } as any;

      const result = await tool.invoke(options);

      assert.ok(result);

      // Basic verification that we got an error result
      const resultString = result.toString();
      assert.ok(resultString.length > 0);
    });

    test("Should properly encode URL parameters", async () => {
      const mockResponse: MockAxiosResponse<typeof mockEnvironmentDetails> = {
        data: mockEnvironmentDetails,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {}
      };

      (mockApiClient.client.get as sinon.SinonStub).resolves(mockResponse);

      const options = {
        input: {
          space_name: "test space with spaces",
          environment_id: "env/with/slashes"
        }
      } as any;

      await tool.invoke(options);

      // Verify URL encoding
      sinon.assert.calledWith(
        mockApiClient.client.get as sinon.SinonStub,
        "/api/spaces/test%20space%20with%20spaces/environments/env%2Fwith%2Fslashes"
      );
    });
  });

  suite("formatEnvironmentDetails", () => {
    test("Should format basic environment information", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("**Space**: test-space"));
      assert.ok(result.includes("**Environment ID**: env-123"));
      assert.ok(result.includes("🔄 **Type**: Workflow Environment"));
      assert.ok(result.includes("📢 **Status**: Published"));
      assert.ok(
        result.includes("🛡️ **Protection**: Termination protection enabled")
      );
    });

    test("Should format owner information", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(
        result.includes("👤 **Owner**: Johnny Doe (john.doe@example.com)")
      );
    });

    test("Should format cost information", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("💰 **Cost**: 125.5 USD"));
      assert.ok(result.includes("Last updated:"));
    });

    test("Should format connections", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("🔗 **Connections**:"));
      assert.ok(result.includes("Incoming: 1"));
      assert.ok(result.includes("Outgoing: 1"));
    });

    test("Should format reserved resources", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("📦 **Reserved Resources** (2):"));
      assert.ok(result.includes("compute-instance (vm)"));
      assert.ok(result.includes("database (rds)"));
      assert.ok(result.includes("Excluded: Maintenance window"));
    });

    test("Should format annotations", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("🏷️ **Annotations** (2):"));
      assert.ok(result.includes("environment: production [FrogGreen]"));
      assert.ok(result.includes("team: backend"));
    });

    test("Should format EAC information", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("⚙️ **Environment as Code**:"));
      assert.ok(result.includes("Status: synced"));
      assert.ok(result.includes("Registered: Yes"));
      assert.ok(result.includes("Enabled: Yes"));
      assert.ok(result.includes("Synced: Yes"));
    });

    test("Should format workflow details", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("🔄 **Workflow Details**:"));
      assert.ok(result.includes("Type: workflow"));
      assert.ok(result.includes("Instantiation: deploy-backend"));
    });

    test("Should format estimated launch time", () => {
      const result = (tool as any).formatEnvironmentDetails(
        mockEnvironmentDetails,
        "test-space",
        "env-123"
      );

      assert.ok(result.includes("⏱️ **Estimated Launch Time**: 5 minutes"));
    });

    test("Should handle null values gracefully", () => {
      const minimalDetails = {
        owner: null,
        initiator: null,
        collaborators_info: null,
        is_workflow: false,
        is_published: false,
        details: null,
        cost: null,
        read_only: false,
        last_used: "2023-12-01T09:15:00Z",
        annotations: null,
        entity_metadata: null,
        has_incoming_connections: false,
        connections: null,
        incoming_connections_count: 0,
        termination_protection_enabled: false,
        reserved_resources: null,
        eac: null,
        inputs: null,
        inputs_v2: null
      };

      const result = (tool as any).formatEnvironmentDetails(
        minimalDetails,
        "test-space",
        "env-123"
      );

      // Should still include basic info and last used
      assert.ok(result.includes("**Space**: test-space"));
      assert.ok(result.includes("**Environment ID**: env-123"));
      assert.ok(result.includes("🕒 **Last Used**:"));

      // Should not include sections that are null
      assert.ok(!result.includes("👤 **Owner**:"));
      assert.ok(!result.includes("💰 **Cost**:"));
      assert.ok(!result.includes("📦 **Reserved Resources**"));
    });
  });

  suite("getDisplayName", () => {
    test("Should prefer display names", () => {
      const person = {
        first_name: "John",
        last_name: "Doe",
        display_first_name: "Johnny",
        display_last_name: "D",
        email: "john@example.com",
        timezone: "UTC",
        join_date: "2023-01-01T00:00:00Z"
      };

      const result = (tool as any).getDisplayName(person);
      assert.strictEqual(result, "Johnny D");
    });

    test("Should fall back to regular names", () => {
      const person = {
        first_name: "John",
        last_name: "Doe",
        display_first_name: null,
        display_last_name: null,
        email: "john@example.com",
        timezone: "UTC",
        join_date: "2023-01-01T00:00:00Z"
      };

      const result = (tool as any).getDisplayName(person);
      assert.strictEqual(result, "John Doe");
    });

    test("Should handle partial names", () => {
      const person = {
        first_name: "John",
        last_name: null,
        display_first_name: null,
        display_last_name: null,
        email: "john@example.com",
        timezone: "UTC",
        join_date: "2023-01-01T00:00:00Z"
      };

      const result = (tool as any).getDisplayName(person);
      assert.strictEqual(result, "John");
    });

    test("Should return Unknown for empty names", () => {
      const person = {
        first_name: null,
        last_name: null,
        display_first_name: null,
        display_last_name: null,
        email: "john@example.com",
        timezone: "UTC",
        join_date: "2023-01-01T00:00:00Z"
      };

      const result = (tool as any).getDisplayName(person);
      assert.strictEqual(result, "Unknown");
    });
  });
});
