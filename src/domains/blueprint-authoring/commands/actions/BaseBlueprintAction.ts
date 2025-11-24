/**
 * Base class for blueprint actions
 */

import * as vscode from "vscode";
import * as path from "path";
import type { ApiClient } from "../../../../api/ApiClient";
import type { SettingsManager } from "../../../setup/SettingsManager";

export abstract class BaseBlueprintAction {
  constructor(
    protected readonly settingsManager: SettingsManager,
    protected readonly getApiClient: () => ApiClient | null
  ) {}

  /**
   * Execute the action
   */
  abstract execute(uri: vscode.Uri): Promise<void>;

  /**
   * Get a non-null API client or show error
   */
  protected async getClientOrShowError(): Promise<ApiClient | null> {
    const client = this.getApiClient();
    if (!client) {
      const configure = await vscode.window.showErrorMessage(
        "Torque AI is not configured. Please configure it first.",
        "Configure Now"
      );
      if (configure === "Configure Now") {
        await vscode.commands.executeCommand("torque.setup");
      }
      return null;
    }
    return client;
  }

  /**
   * Get the active space name or show error
   */
  protected async getSpaceNameOrShowError(): Promise<string | null> {
    const activeSpace =
      await this.settingsManager.getSetting<string>("activeSpace");
    const defaultSpace = await this.settingsManager.getSetting<string>("space");
    const spaceName = activeSpace ?? defaultSpace;

    if (!spaceName) {
      vscode.window.showErrorMessage(
        "No active space set. Please set an active space first."
      );
      return null;
    }

    return spaceName;
  }

  /**
   * Get the blueprint name from the file URI
   */
  protected getBlueprintName(uri: vscode.Uri): string {
    const fileName = path.basename(uri.fsPath);
    return fileName.replace(/\.ya?ml$/i, "");
  }
}
