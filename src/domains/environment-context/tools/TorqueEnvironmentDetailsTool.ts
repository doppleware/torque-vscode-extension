import * as vscode from "vscode";
import type { ApiClient } from "../../../api/ApiClient";
import { getClient } from "../../../extension";

interface EnvironmentDetailsParameters {
  space_name: string;
  environment_id: string;
}

interface EnvironmentOwner {
  first_name: string | null;
  last_name: string | null;
  timezone: string | null;
  email: string | null;
  join_date: string;
  display_first_name: string | null;
  display_last_name: string | null;
}

interface EnvironmentCost {
  sum: number;
  last_update: string;
  final: boolean;
  currency: string | null;
  incomplete: boolean;
}

interface EnvironmentAnnotation {
  key: string | null;
  value: string | null;
  color: "FrogGreen" | "Grey" | null;
  filterable: boolean;
  last_updated: string;
}

interface GrainWithResources {
  grain_name: string;
  resources: {
    name: string;
    type: string;
    dependency_identifier: string;
    attributes?: Record<string, string>;
    tags?: Record<string, string>;
    depends_on?: string[];
  }[];
}

interface EnvironmentDetails {
  owner: EnvironmentOwner | null;
  initiator: EnvironmentOwner | null;
  collaborators_info: {
    collaborators: Record<string, unknown>[] | null;
    collaborators_groups: Record<string, unknown>[] | null;
    all_space_members: boolean;
  } | null;
  is_workflow: boolean;
  is_published: boolean;
  details: {
    state: Record<string, unknown> | null;
    id: string | null;
    definition: Record<string, unknown> | null;
    computed_status: Record<string, unknown> | null;
    estimated_launch_duration_in_seconds: number | null;
  } | null;
  cost: EnvironmentCost | null;
  read_only: boolean;
  last_used: string;
  annotations: EnvironmentAnnotation[] | null;
  entity_metadata: {
    type: string;
    workflow_instantiation_name: string | null;
  } | null;
  has_incoming_connections: boolean;
  connections: {
    outgoing_connections: Record<string, unknown>[] | null;
    outgoing_connections_count: number;
    incoming_connections: Record<string, unknown>[] | null;
    incoming_connections_count: number;
  } | null;
  incoming_connections_count: number;
  termination_protection_enabled: boolean;
  reserved_resources:
    | {
        id: string | null;
        name: string | null;
        type: string | null;
        excluded_from_reserving: boolean;
        excluded_from_reserving_reason: string | null;
      }[]
    | null;
  eac: {
    url: string | null;
    status: string | null;
    eac_synced: boolean;
    registered: boolean;
    enabled: boolean;
    errors: Record<string, unknown>[] | null;
    validation_errors: Record<string, unknown>[] | null;
  } | null;
  inputs: Record<string, unknown> | null;
  inputs_v2: Record<string, unknown>[] | null;
  grain_resources?: GrainWithResources[];
}

export class TorqueEnvironmentDetailsTool
  implements vscode.LanguageModelTool<EnvironmentDetailsParameters>
{
  private client?: ApiClient;

  constructor(client?: ApiClient) {
    this.client = client;
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationOptions<EnvironmentDetailsParameters>
  ): vscode.PreparedToolInvocation {
    const { space_name, environment_id } = options.input;

    return {
      invocationMessage: `Fetching environment details for ${environment_id} in space ${space_name}`,
      confirmationMessages: {
        title: "Get Torque Environment Details",
        message: new vscode.MarkdownString(
          `**Space**: ${space_name}\n` +
            `**Environment ID**: ${environment_id}\n\n` +
            `Fetching environment details from Torque API.`
        )
      }
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<EnvironmentDetailsParameters>
  ): Promise<vscode.LanguageModelToolResult> {
    const { space_name, environment_id } = options.input;

    try {
      const environmentDetails = await this.getEnvironmentDetails(
        space_name,
        environment_id
      );
      const formattedDetails = this.formatEnvironmentDetails(
        environmentDetails,
        space_name,
        environment_id
      );

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `## Environment Details: ${environment_id}\n\n${formattedDetails}`
        )
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `❌ **Error**: Failed to fetch environment details: ${error instanceof Error ? error.message : "Unknown error"}\n\n` +
            `Please check your Torque configuration and ensure the space name and environment ID are correct.`
        )
      ]);
    }
  }

  private async getEnvironmentDetails(
    spaceName: string,
    environmentId: string
  ): Promise<EnvironmentDetails> {
    try {
      const client = this.getApiClient();

      // Ensure we're authenticated before making the request
      await this.ensureAuthenticated(client);

      const response = await client.client.get<EnvironmentDetails>(
        `/api/spaces/${encodeURIComponent(spaceName)}/environments/${encodeURIComponent(environmentId)}`
      );

      // Check if response status is 200
      if (response.status !== 200) {
        throw new Error(
          `API request failed with status ${response.status}: ${response.statusText}`
        );
      }

      // Check if response data exists
      if (!response.data) {
        throw new Error("No data received from API");
      }

      return response.data;
    } catch (error) {
      throw new Error(
        `API request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async ensureAuthenticated(
    client: ReturnType<typeof getClient>
  ): Promise<void> {
    try {
      // Try to make a simple authenticated request to check if we're logged in
      // If this fails, we'll need to login
      await client.client.get("/api/health", {
        validateStatus: (status: number) => status < 500
      });
    } catch {
      // If we get a 401 or other auth error, attempt to login
      // Note: In a real implementation, you'd get credentials from VS Code settings or prompt user
      throw new Error(
        "Authentication required. Please ensure you are logged in to Torque."
      );
    }
  }

  protected getApiClient() {
    return this.client ?? getClient();
  }

  public async getEnvironmentDetailsJson(
    spaceName: string,
    environmentId: string
  ): Promise<EnvironmentDetails> {
    return this.getEnvironmentDetails(spaceName, environmentId);
  }

  private formatEnvironmentDetails(
    details: EnvironmentDetails,
    spaceName: string,
    environmentId: string
  ): string {
    let result = `**Space**: ${spaceName}\n`;
    result += `**Environment ID**: ${environmentId}\n\n`;

    // Status and basic info
    if (details.is_workflow) {
      result += `🔄 **Type**: Workflow Environment\n`;
    }
    if (details.is_published) {
      result += `📢 **Status**: Published\n`;
    }
    if (details.read_only) {
      result += `🔒 **Access**: Read-only\n`;
    }
    if (details.termination_protection_enabled) {
      result += `🛡️ **Protection**: Termination protection enabled\n`;
    }

    result += `\n`;

    // Owner information
    if (details.owner) {
      const owner = details.owner;
      const displayName = this.getDisplayName(owner);
      result += `👤 **Owner**: ${displayName}`;
      if (owner.email) {
        result += ` (${owner.email})`;
      }
      result += `\n`;
    }

    // Cost information
    if (details.cost) {
      const cost = details.cost;
      result += `💰 **Cost**: ${cost.sum}`;
      if (cost.currency) {
        result += ` ${cost.currency}`;
      }
      if (cost.final) {
        result += ` (Final)`;
      } else if (cost.incomplete) {
        result += ` (Incomplete)`;
      }
      result += `\n`;
      result += `   Last updated: ${new Date(cost.last_update).toLocaleString()}\n`;
    }

    // Last used
    result += `🕒 **Last Used**: ${new Date(details.last_used).toLocaleString()}\n\n`;

    // Connections
    if (details.connections) {
      const conn = details.connections;
      if (
        conn.incoming_connections_count > 0 ||
        conn.outgoing_connections_count > 0
      ) {
        result += `🔗 **Connections**:\n`;
        result += `   Incoming: ${conn.incoming_connections_count}\n`;
        result += `   Outgoing: ${conn.outgoing_connections_count}\n\n`;
      }
    }

    // Reserved resources
    if (details.reserved_resources && details.reserved_resources.length > 0) {
      result += `📦 **Reserved Resources** (${details.reserved_resources.length}):\n`;
      details.reserved_resources.slice(0, 5).forEach((resource) => {
        result += `   - ${resource.name ?? resource.id ?? "Unknown"} (${resource.type ?? "Unknown type"})`;
        if (resource.excluded_from_reserving) {
          result += ` - Excluded: ${resource.excluded_from_reserving_reason ?? "No reason provided"}`;
        }
        result += `\n`;
      });
      if (details.reserved_resources.length > 5) {
        result += `   ... and ${details.reserved_resources.length - 5} more\n`;
      }
      result += `\n`;
    }

    // Annotations
    if (details.annotations && details.annotations.length > 0) {
      result += `🏷️ **Annotations** (${details.annotations.length}):\n`;
      details.annotations.slice(0, 5).forEach((annotation) => {
        if (annotation.key && annotation.value) {
          result += `   - ${annotation.key}: ${annotation.value}`;
          if (annotation.color) {
            result += ` [${annotation.color}]`;
          }
          result += `\n`;
        }
      });
      if (details.annotations.length > 5) {
        result += `   ... and ${details.annotations.length - 5} more\n`;
      }
      result += `\n`;
    }

    // EAC (Environment as Code) status
    if (details.eac) {
      result += `⚙️ **Environment as Code**:\n`;
      result += `   Status: ${details.eac.status ?? "Unknown"}\n`;
      result += `   Registered: ${details.eac.registered ? "Yes" : "No"}\n`;
      result += `   Enabled: ${details.eac.enabled ? "Yes" : "No"}\n`;
      result += `   Synced: ${details.eac.eac_synced ? "Yes" : "No"}\n`;
      if (details.eac.url) {
        result += `   URL: ${details.eac.url}\n`;
      }
      if (details.eac.errors && details.eac.errors.length > 0) {
        result += `   ⚠️ Errors: ${details.eac.errors.length}\n`;
      }
    }

    // Workflow metadata
    if (details.entity_metadata && details.is_workflow) {
      result += `\n🔄 **Workflow Details**:\n`;
      result += `   Type: ${details.entity_metadata.type}\n`;
      if (details.entity_metadata.workflow_instantiation_name) {
        result += `   Instantiation: ${details.entity_metadata.workflow_instantiation_name}\n`;
      }
    }

    // Estimated launch duration
    if (details.details?.estimated_launch_duration_in_seconds) {
      const minutes = Math.round(
        details.details.estimated_launch_duration_in_seconds / 60
      );
      result += `\n⏱️ **Estimated Launch Time**: ${minutes} minutes\n`;
    }

    return result;
  }

  private getDisplayName(person: EnvironmentOwner): string {
    if (person.display_first_name || person.display_last_name) {
      return `${person.display_first_name ?? ""} ${person.display_last_name ?? ""}`.trim();
    }
    if (person.first_name || person.last_name) {
      return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    }
    return "Unknown";
  }
}
