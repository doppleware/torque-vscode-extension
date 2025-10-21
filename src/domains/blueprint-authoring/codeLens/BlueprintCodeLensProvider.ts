/**
 * Blueprint CodeLens Provider
 *
 * Provides CodeLens above the spec_version line in blueprint YAML files showing:
 * - Active Torque space
 * - Environment status (active/inactive)
 * - Blueprint actions (Validate, Deploy)
 * A blueprint is identified by the presence of the Quali Torque schema reference.
 */

import * as vscode from "vscode";
import * as path from "path";
import type { SettingsManager } from "../../setup/SettingsManager";
import type { ApiClient } from "../../../api/ApiClient";
import { BLUEPRINT_SCHEMA_URL } from "../templates/blueprintTemplate";

export class BlueprintCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(
    private settingsManager: SettingsManager,
    private getApiClient: () => ApiClient | null
  ) {}

  /**
   * Refresh CodeLens when settings change
   */
  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Provide CodeLens items for the document
   */
  async provideCodeLenses(
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    // Only process YAML files
    if (document.languageId !== "yaml") {
      return [];
    }

    // Check if this is a blueprint file by looking for the schema reference
    if (!this.isBlueprintFile(document)) {
      return [];
    }

    // Get the active space (with fallback to default space)
    const { spaceName, isDefault } = await this.getActiveSpace();

    // Find the spec_version line to place CodeLens above it
    const specVersionLine = this.findSpecVersionLine(document);
    const codeLensPosition = new vscode.Range(
      specVersionLine,
      0,
      specVersionLine,
      0
    );

    // Active Space CodeLens
    const spaceTitle = isDefault
      ? `Active Space: ${spaceName} (Default)`
      : `Active Space: ${spaceName}`;

    const spaceCodeLens = new vscode.CodeLens(codeLensPosition, {
      title: spaceTitle,
      command: "torque.setActiveSpace",
      tooltip: "Click to change the active Torque space for this workspace"
    });

    // Environment Status CodeLens
    const environmentStatusCodeLens =
      await this.createEnvironmentStatusCodeLens(document, codeLensPosition);

    // Actions CodeLens
    const actionsCodeLens = new vscode.CodeLens(codeLensPosition, {
      title: "Actions...",
      command: "torque.blueprintActions",
      tooltip: "Blueprint actions (Validate, Deploy)",
      arguments: [document.uri]
    });

    return [spaceCodeLens, environmentStatusCodeLens, actionsCodeLens];
  }

  /**
   * Create the environment status CodeLens
   */
  private async createEnvironmentStatusCodeLens(
    document: vscode.TextDocument,
    position: vscode.Range
  ): Promise<vscode.CodeLens> {
    const apiClient = this.getApiClient();

    if (!apiClient) {
      // No API client available, show "Not Configured" status
      return new vscode.CodeLens(position, {
        title: "Inactive",
        command: "",
        tooltip: "Configure Torque AI to see active environments"
      });
    }

    try {
      // Get blueprint name from file name (without extension)
      const blueprintName = this.getBlueprintName(document);

      // Fetch active environments
      const response =
        await apiClient.environments.getActiveEnvironments(blueprintName);

      const environmentCount = response.environment_list.length;

      if (environmentCount === 0) {
        return new vscode.CodeLens(position, {
          title: "Inactive",
          command: "",
          tooltip: "No active environments for this blueprint"
        });
      }

      // Show "Running (x)" with command to list environments
      return new vscode.CodeLens(position, {
        title: `Running (${environmentCount})`,
        command: "torque.showBlueprintEnvironments",
        tooltip: "Click to view active environments",
        arguments: [blueprintName, response.environment_list]
      });
    } catch (error) {
      // If API call fails, show "Inactive" (don't fail the whole CodeLens)
      return new vscode.CodeLens(position, {
        title: "Inactive",
        command: "",
        tooltip:
          error instanceof Error
            ? `Failed to fetch environments: ${error.message}`
            : "Failed to fetch environments"
      });
    }
  }

  /**
   * Get blueprint name from document (file name without extension)
   */
  private getBlueprintName(document: vscode.TextDocument): string {
    const fileName = path.basename(document.uri.fsPath);
    return fileName.replace(/\.(yaml|yml)$/i, "");
  }

  /**
   * Find the line number where spec_version is defined
   * Returns the line number, or 0 if not found
   */
  private findSpecVersionLine(document: vscode.TextDocument): number {
    const text = document.getText();
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (/^\s*spec_version:\s*/.test(lines[i])) {
        return i;
      }
    }

    // If spec_version is not found, place CodeLens at the top of the file
    return 0;
  }

  /**
   * Check if a document is a blueprint file by looking for the Torque schema reference
   * The schema MUST be defined in the first line of the file
   */
  private isBlueprintFile(document: vscode.TextDocument): boolean {
    // Get the first line of the document
    if (document.lineCount === 0) {
      return false;
    }

    const firstLine = document.lineAt(0).text;

    // Check for the yaml-language-server schema directive with Torque blueprint schema
    // Matches: # yaml-language-server: $schema=<blueprint-schema-url>
    const schemaPattern = new RegExp(
      `#\\s*yaml-language-server:\\s*\\$schema\\s*=\\s*${this.escapeRegExp(BLUEPRINT_SCHEMA_URL)}`,
      "i"
    );

    return schemaPattern.test(firstLine);
  }

  /**
   * Get the active space, with fallback to default space
   */
  private async getActiveSpace(): Promise<{
    spaceName: string;
    isDefault: boolean;
  }> {
    // Try to get workspace-specific active space first
    const activeSpace =
      await this.settingsManager.getSetting<string>("activeSpace");

    if (activeSpace) {
      return { spaceName: activeSpace, isDefault: false };
    }

    // Fall back to default space
    const defaultSpace = await this.settingsManager.getSetting<string>("space");

    if (defaultSpace) {
      return { spaceName: defaultSpace, isDefault: true };
    }

    // No space configured
    return { spaceName: "Not Set", isDefault: false };
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
