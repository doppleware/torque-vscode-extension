/**
 * Blueprint CodeLens Provider
 *
 * Provides CodeLens at the top of blueprint YAML files showing the active Torque space.
 * A blueprint is identified by the presence of the Quali Torque schema reference.
 */

import * as vscode from "vscode";
import type { SettingsManager } from "../../setup/SettingsManager";
import { BLUEPRINT_SCHEMA_URL } from "../templates/blueprintTemplate";

export class BlueprintCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(private settingsManager: SettingsManager) {}

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

    // Create CodeLens at the top of the file (line 0)
    const topOfDocument = new vscode.Range(0, 0, 0, 0);
    const title = isDefault
      ? `Active Space: ${spaceName} (Default)`
      : `Active Space: ${spaceName}`;

    const codeLens = new vscode.CodeLens(topOfDocument, {
      title,
      command: "torque.setActiveSpace",
      tooltip: "Click to change the active Torque space for this workspace"
    });

    return [codeLens];
  }

  /**
   * Check if a document is a blueprint file by looking for the Torque schema reference
   */
  private isBlueprintFile(document: vscode.TextDocument): boolean {
    const text = document.getText();

    // Check for the yaml-language-server schema directive with Torque blueprint schema
    // Matches: # yaml-language-server: $schema=<blueprint-schema-url>
    const schemaPattern = new RegExp(
      `#\\s*yaml-language-server:\\s*\\$schema\\s*=\\s*${this.escapeRegExp(BLUEPRINT_SCHEMA_URL)}`,
      "i"
    );

    if (schemaPattern.test(text)) {
      return true;
    }

    // Also check for spec_version: 2 as a secondary indicator
    // This is a common pattern in Torque blueprints
    const specVersionPattern = /spec_version:\s*2/;
    if (specVersionPattern.test(text)) {
      return true;
    }

    return false;
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
