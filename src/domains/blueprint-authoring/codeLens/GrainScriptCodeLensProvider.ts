/**
 * Grain Script CodeLens Provider
 *
 * Provides CodeLens above each Helm grain element in blueprint YAML files showing:
 * - "Add Script" action to add post-helm-install scripts to Helm grains
 *
 * Only grains with `kind: helm` will show the CodeLens.
 */

import * as vscode from "vscode";
import { BLUEPRINT_SCHEMA_URL } from "../templates/blueprintTemplate";

export class GrainScriptCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  /**
   * Refresh CodeLens when needed
   */
  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Provide CodeLens items for the document
   */
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    // Only process YAML files
    if (document.languageId !== "yaml") {
      return [];
    }

    // Check if this is a blueprint file by looking for the schema reference
    if (!this.isBlueprintFile(document)) {
      return [];
    }

    // Find all grain definitions in the document
    const grainPositions = this.findGrainPositions(document);

    // Create CodeLens for each grain
    const codeLenses = grainPositions.map((grainInfo) => {
      const position = new vscode.Range(grainInfo.line, 0, grainInfo.line, 0);

      return new vscode.CodeLens(position, {
        title: "$(add) Add Script",
        command: "torque.addGrainScript",
        tooltip: "Add a post-helm-install script to this grain",
        arguments: [document.uri, grainInfo.grainName, grainInfo.line]
      });
    });

    return codeLenses;
  }

  /**
   * Find all grain definitions in the document
   * Returns an array of grain names and their line numbers
   * Only includes grains with kind: helm
   */
  private findGrainPositions(
    document: vscode.TextDocument
  ): { grainName: string; line: number }[] {
    const text = document.getText();
    const lines = text.split("\n");

    const grains: { grainName: string; line: number }[] = [];
    let inGrainsSection = false;
    let currentGrain: { grainName: string; line: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if we've entered the grains section
      if (/^grains:\s*$/.test(line)) {
        inGrainsSection = true;
        continue;
      }

      // If we hit another top-level section, exit grains section
      if (inGrainsSection && /^[a-zA-Z_][a-zA-Z0-9_-]*:\s*$/.test(line)) {
        inGrainsSection = false;
        currentGrain = null;
      }

      // If we're in the grains section, look for grain definitions (2-space indent)
      if (inGrainsSection) {
        const grainMatch = /^ {2}([a-zA-Z0-9_-]+):\s*$/.exec(line);
        if (grainMatch) {
          const grainName = grainMatch[1];
          // Save the previous grain position before replacing it
          currentGrain = { grainName, line: i };
          continue;
        }

        // Check if current grain has kind: helm (4-space indent)
        if (currentGrain) {
          const kindMatch = /^ {4}kind:\s*helm\s*$/.exec(line);
          if (kindMatch) {
            grains.push(currentGrain);
            currentGrain = null; // Reset to avoid duplicates
          }
        }
      }
    }

    return grains;
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
    const schemaPattern = new RegExp(
      `#\\s*yaml-language-server:\\s*\\$schema\\s*=\\s*${this.escapeRegExp(BLUEPRINT_SCHEMA_URL)}`,
      "i"
    );

    return schemaPattern.test(firstLine);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
