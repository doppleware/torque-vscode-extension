import * as yaml from "js-yaml";

/**
 * Transforms full environment details into a simplified schema
 * to reduce temp file size and include only relevant information
 */

export interface InputValue {
  name: string;
  value: string;
}

export interface GrainActivity {
  name: string;
  logs_id: string;
  status: string;
}

export interface GrainState {
  current_state: string;
  activities: GrainActivity[];
}

export interface GrainResource {
  name: string;
  type: string;
}

export interface GrainDetails {
  path: string;
  kind: string;
  execution_host: string;
  inputs: InputValue[];
  state: GrainState;
  resources: GrainResource[];
}

export interface SimplifiedEnvironmentDetails {
  environment_id: string;
  space_name: string;
  status: string;
  inputs: InputValue[];
  grains: Record<string, GrainDetails>[];
}

export class EnvironmentDetailsTransformer {
  /**
   * Transforms full environment details into a simplified schema
   * containing only: environment_id, status, and grains with their resources
   */
  static transform(
    fullDetails: unknown,
    grainResources: {
      grain_name: string;
      resources: {
        name: string;
        type: string;
        dependency_identifier: string;
        attributes?: Record<string, string>;
        tags?: Record<string, string>;
        depends_on?: string[];
      }[];
    }[]
  ): SimplifiedEnvironmentDetails {
    const simplified: SimplifiedEnvironmentDetails = {
      environment_id: "",
      space_name: "",
      status: "",
      inputs: [],
      grains: []
    };

    // Type guard to check if fullDetails has the expected structure
    if (!fullDetails || typeof fullDetails !== "object") {
      return simplified;
    }

    const envDetails = fullDetails as {
      details?: {
        id?: string;
        computed_status?: string;
        definition?: {
          metadata?: {
            space_name?: string;
          };
          inputs?: {
            name?: string;
            value?: string;
          }[];
        };
        state?: {
          grains?: {
            id?: string;
            name?: string;
            path?: string;
            kind?: string;
            execution_host?: string;
            inputs?: {
              name?: string;
              value?: string;
            }[];
            state?: {
              current_state?: string;
              stages?: {
                activities?: {
                  id?: string;
                  name?: string;
                  status?: string;
                }[];
              }[];
            };
          }[];
        };
      };
    };

    // Extract environment_id from details.id
    if (envDetails.details?.id) {
      simplified.environment_id = envDetails.details.id;
    }

    // Extract space_name from details.definition.metadata.space_name
    if (envDetails.details?.definition?.metadata?.space_name) {
      simplified.space_name = envDetails.details.definition.metadata.space_name;
    }

    // Extract status from details.computed_status
    if (envDetails.details?.computed_status) {
      simplified.status = envDetails.details.computed_status;
    }

    // Extract environment-level inputs from details.definition.inputs
    if (envDetails.details?.definition?.inputs) {
      simplified.inputs = envDetails.details.definition.inputs
        .filter((input) => input.name && input.value)
        .map((input) => ({
          name: input.name ?? "",
          value: input.value ?? ""
        }));
    }

    // Extract grains and combine with resources
    if (envDetails.details?.state?.grains) {
      simplified.grains = envDetails.details.state.grains.map((grain) => {
        const grainName = grain.name ?? "";

        // Find matching resources for this grain
        const matchingResources = grainResources.find(
          (gr) => gr.grain_name === grainName
        );

        // Extract activities from stages
        const activities: GrainActivity[] = [];
        if (grain.state?.stages) {
          grain.state.stages.forEach((stage) => {
            if (stage.activities) {
              stage.activities.forEach((activity) => {
                activities.push({
                  name: activity.name ?? "",
                  logs_id: activity.id ?? "",
                  status: activity.status ?? ""
                });
              });
            }
          });
        }

        // Extract grain-level inputs
        const grainInputs: InputValue[] = grain.inputs
          ? grain.inputs
              .filter((input) => input.name && input.value)
              .map((input) => ({
                name: input.name ?? "",
                value: input.value ?? ""
              }))
          : [];

        // Build grain details
        const grainDetails: GrainDetails = {
          path: grain.path ?? "",
          kind: grain.kind ?? "",
          execution_host: grain.execution_host ?? "",
          inputs: grainInputs,
          state: {
            current_state: grain.state?.current_state ?? "",
            activities
          },
          resources:
            matchingResources?.resources.map((r) => ({
              name: r.name,
              type: r.type
            })) ?? []
        };

        // Return as a single-key object with grain name as the key
        return { [grainName]: grainDetails };
      });
    }

    return simplified;
  }

  /**
   * Converts simplified environment details to a formatted YAML string
   */
  static toYAML(simplified: SimplifiedEnvironmentDetails): string {
    return yaml.dump(simplified, {
      indent: 2,
      lineWidth: -1,
      noRefs: true
    });
  }
}
