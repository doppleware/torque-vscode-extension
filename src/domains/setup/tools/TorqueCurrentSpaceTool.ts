import * as vscode from "vscode";
import type { SettingsManager } from "../SettingsManager";

/**
 * Language Model Tool to get the current Torque space
 * Returns the active space if set, otherwise returns the default space
 */
export class TorqueCurrentSpaceTool implements vscode.LanguageModelTool<void> {
  private settingsManager?: SettingsManager;

  constructor(settingsManager?: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  prepareInvocation(): vscode.PreparedToolInvocation {
    return {
      invocationMessage: "Getting current Torque space",
      confirmationMessages: {
        title: "Get Current Torque Space",
        message: new vscode.MarkdownString(
          "Retrieving the currently active or default Torque space."
        )
      }
    };
  }

  async invoke(): Promise<vscode.LanguageModelToolResult> {
    try {
      if (!this.settingsManager) {
        throw new Error("SettingsManager not available");
      }

      // Get active space (workspace-level override)
      const activeSpace =
        await this.settingsManager.getSetting<string>("activeSpace");

      // Get default space (global setting)
      const defaultSpace =
        await this.settingsManager.getSetting<string>("space");

      // Active space takes precedence, fall back to default space
      const currentSpace = activeSpace ?? defaultSpace;

      if (!currentSpace) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            "⚠️ **No Torque space configured**\n\n" +
              "Neither an active space nor a default space is set. Please configure a Torque space using:\n" +
              "- `Torque: Set Active Torque Space` - Set workspace-specific space\n" +
              "- `Torque: Set Default Torque Space` - Set global default space"
          )
        ]);
      }

      let result = `## Current Torque Space\n\n`;
      result += `**Space Name**: ${currentSpace}\n\n`;

      if (activeSpace && defaultSpace && activeSpace === defaultSpace) {
        result += `**Status**: Active space (same as default space)\n`;
      } else if (activeSpace) {
        result += `**Status**: Active space (workspace override)\n`;
        if (defaultSpace) {
          result += `**Default Space**: ${defaultSpace} (not currently active)\n`;
        }
      } else if (defaultSpace) {
        result += `**Status**: Default space (no workspace override set)\n`;
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(result)
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `❌ **Error**: Failed to get current Torque space: ${error instanceof Error ? error.message : "Unknown error"}\n\n` +
            `Please ensure the Torque AI extension is properly configured.`
        )
      ]);
    }
  }
}
