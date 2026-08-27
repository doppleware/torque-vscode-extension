import * as vscode from "vscode";
import { promptAndConfigureAgents } from "../../mcp/configureAgents";
import type { SettingsManager } from "../SettingsManager";

export const registerConfigureAgentsCommand = (
  settingsManager: SettingsManager
): vscode.Disposable =>
  vscode.commands.registerCommand("torque.configureAgents", async () => {
    const url = await settingsManager.getSetting<string>("url");
    const token = await settingsManager.getSetting<string>("token");

    if (!url || !token) {
      vscode.window.showWarningMessage(
        "Torque is not configured yet. Run 'Configure Torque AI' first."
      );
      return;
    }

    const preselected =
      (await settingsManager.getSetting<string[]>("chatAgents")) ?? [];
    const configured = await promptAndConfigureAgents(url, token, preselected);

    if (configured) {
      await settingsManager.setSetting(
        "chatAgents",
        configured.agents,
        vscode.ConfigurationTarget.Global
      );
      await settingsManager.setSetting(
        "primaryChatAgent",
        configured.primaryAgent ?? "",
        vscode.ConfigurationTarget.Global
      );
    }
  });
