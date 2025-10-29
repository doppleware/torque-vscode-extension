/**
 * Deployment Form
 *
 * Manages the interactive form for collecting deployment inputs.
 * Provides multi-step interface with field validation, auto-selection,
 * and integration with deployment values caching.
 *
 * @see {@link file://../../spec/environment_deployment.md} Environment Deployment Specification
 */

import * as vscode from "vscode";

interface FormField {
  type: "input" | "select";
  name: string;
  label: string;
  value: string;
  options?: { value: string; display_value: string | null }[];
  inputType?: string;
}

export interface DeploymentFormResult {
  environmentName: string;
  inputs: Record<string, string>;
}

export class DeploymentForm {
  private validationError = "";

  constructor(
    private readonly blueprintName: string,
    private readonly inputsNeedingUserInput: {
      name: string;
      config: { type: string; default?: string | number };
      allowedValues: { value: string; display_value: string | null }[];
    }[],
    private readonly currentInputValues: Record<string, string>,
    private readonly cachedEnvironmentName?: string
  ) {}

  /**
   * Show the deployment form and collect user input
   */
  async show(): Promise<DeploymentFormResult | undefined> {
    const formState: Record<string, string> = { ...this.currentInputValues };

    // Generate default environment name with timestamp if no cached value
    const getDefaultEnvironmentName = (): string => {
      if (this.cachedEnvironmentName) {
        return this.cachedEnvironmentName;
      }
      // Format: blueprint-name-20251023T090459
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0]; // Remove separators and milliseconds
      return `${this.blueprintName}-${timestamp}`;
    };

    let environmentName = getDefaultEnvironmentName();

    const fields: FormField[] = [
      {
        type: "input",
        name: "_environment_name",
        label: "Environment Name",
        value: environmentName,
        inputType: "string"
      },
      ...this.inputsNeedingUserInput.map((input) => ({
        type:
          input.allowedValues.length > 0
            ? ("select" as const)
            : ("input" as const),
        name: input.name,
        label: input.name,
        value: formState[input.name] ?? "",
        options: input.allowedValues,
        inputType: input.config.type
      }))
    ];

    // Show interactive form
    while (true) {
      const items = fields.map((field) => {
        const currentValue =
          field.name === "_environment_name"
            ? environmentName
            : formState[field.name];
        const displayValue = currentValue || "(not set)";

        return {
          label: `$(edit) ${field.label}`,
          description: displayValue,
          detail:
            field.type === "select"
              ? `Select from ${field.options?.length ?? 0} option(s)`
              : `Type: ${field.inputType ?? "string"}`,
          field
        };
      });

      // Add validation error display if present
      const errorItems = this.validationError
        ? [
            {
              label: `$(error) ${this.validationError}`,
              description: "",
              detail: "Please fill in the missing fields above",
              field: null as FormField | null,
              kind: vscode.QuickPickItemKind.Separator
            }
          ]
        : [];

      // Add submit and cancel buttons
      const submitItem = {
        label: "$(check) Deploy",
        description: "Deploy the environment with these settings",
        detail: "All required inputs have been configured",
        field: null as FormField | null
      };

      const cancelItem = {
        label: "$(close) Cancel",
        description: "Cancel deployment",
        detail: "",
        field: null as FormField | null
      };

      const selected = await vscode.window.showQuickPick(
        [...items, ...errorItems, submitItem, cancelItem],
        {
          placeHolder: this.validationError
            ? `⚠️  ${this.validationError}`
            : "Configure deployment settings (select a field to edit)",
          title: `Deploy ${this.blueprintName}`,
          matchOnDescription: true,
          matchOnDetail: true
        }
      );

      if (!selected) {
        return undefined; // User cancelled
      }

      if (selected === cancelItem) {
        return undefined; // User cancelled
      }

      if (selected === submitItem) {
        // Validate all required fields are filled
        const missingFields: string[] = [];

        // Check environment name
        if (!environmentName || environmentName.trim() === "") {
          missingFields.push("Environment Name");
        }

        // Check all input fields
        for (const field of fields) {
          if (field.name === "_environment_name") {
            continue; // Already checked above
          }

          const value = formState[field.name];
          if (!value || value.trim() === "") {
            missingFields.push(field.label);
          }
        }

        if (missingFields.length > 0) {
          // Set validation error and re-show the form
          this.validationError = `Missing fields: ${missingFields.join(", ")}`;
          continue; // Keep the form open with error message
        }

        // All fields filled, proceed with deployment
        return { environmentName, inputs: formState };
      }

      // Clear validation error when user edits a field
      this.validationError = "";

      const field = selected.field;
      if (!field) {
        continue;
      }

      // Edit the selected field
      if (field.name === "_environment_name") {
        const value = await vscode.window.showInputBox({
          prompt: "Enter environment name",
          value: environmentName,
          placeHolder: `${this.blueprintName}-env`,
          title: `Deploy ${this.blueprintName} - Environment Name`
        });

        if (value !== undefined) {
          environmentName = value;
        }
      } else if (
        field.type === "select" &&
        field.options &&
        field.options.length > 0
      ) {
        // Show selection for allowed values
        const selectedValue = await vscode.window.showQuickPick(
          field.options.map((opt) => ({
            label: opt.display_value ?? opt.value,
            description:
              opt.value !== opt.display_value ? opt.value : undefined,
            value: opt.value
          })),
          {
            placeHolder: `Select value for "${field.label}"`,
            title: `Deploy ${this.blueprintName} - ${field.label}`
          }
        );

        if (selectedValue) {
          formState[field.name] = selectedValue.value;
        }
      } else {
        // Show input box for free text
        const value = await vscode.window.showInputBox({
          prompt: `Enter value for "${field.label}" (type: ${field.inputType ?? "string"})`,
          value: formState[field.name],
          placeHolder: formState[field.name] || "Enter value...",
          title: `Deploy ${this.blueprintName} - ${field.label}`
        });

        if (value !== undefined) {
          formState[field.name] = value;
        }
      }
    }
  }
}
