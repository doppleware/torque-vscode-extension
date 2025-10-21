/**
 * Transforms full environment details into a simplified schema
 * to reduce temp file size and include only relevant information
 */

export interface SimplifiedEnvironmentDetails {
  state: unknown;
  inputs: unknown[];
  outputs: unknown[];
  grain_resources: {
    grain_name: string;
    resources: {
      name: string;
      type: string;
      dependency_identifier: string;
      attributes?: Record<string, string>;
      tags?: Record<string, string>;
      depends_on?: string[];
    }[];
  }[];
}

export class EnvironmentDetailsTransformer {
  /**
   * Transforms full environment details into a simplified schema
   * containing only: state, inputs, outputs, and grain_resources
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
      state: null,
      inputs: [],
      outputs: [],
      grain_resources: grainResources
    };

    // Type guard to check if fullDetails has the expected structure
    if (!fullDetails || typeof fullDetails !== "object") {
      return simplified;
    }

    const envDetails = fullDetails as {
      details?: {
        state?: unknown;
        definition?: {
          inputs?: unknown[];
          outputs?: unknown[];
        };
      };
    };

    // Extract state
    if (envDetails.details?.state) {
      simplified.state = envDetails.details.state;
    }

    // Extract inputs from definition
    if (envDetails.details?.definition?.inputs) {
      simplified.inputs = envDetails.details.definition.inputs;
    }

    // Extract outputs from definition
    if (envDetails.details?.definition?.outputs) {
      simplified.outputs = envDetails.details.definition.outputs;
    }

    return simplified;
  }

  /**
   * Converts simplified environment details to a formatted JSON string
   */
  static toJSON(simplified: SimplifiedEnvironmentDetails): string {
    return JSON.stringify(simplified, null, 2);
  }
}
