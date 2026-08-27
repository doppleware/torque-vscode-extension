import * as vscode from "vscode";
import { AGENT_MCP_TARGETS } from "../../ides/mcpConfigTargets";
import { logger } from "../../utils/Logger";
import { writeAgentMcpConfig } from "./writeAgentMcpConfig";

export interface ConfiguredAgents {
  agents: string[];
  primaryAgent?: string;
}

export const promptAndConfigureAgents = async (
  url: string,
  token: string,
  preselected: string[] = []
): Promise<ConfiguredAgents | undefined> => {
  const items = AGENT_MCP_TARGETS.map((target) => ({
    label: target.label,
    description: target.description,
    picked: preselected.includes(target.id),
    target
  }));

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: "Which AI chats do you use?",
    placeHolder: "Torque will add its MCP server to the ones you select"
  });

  if (!picked || !Array.isArray(picked) || picked.length === 0) {
    return undefined;
  }

  const configured: string[] = [];
  const written: string[] = [];
  const failed: string[] = [];

  for (const item of picked) {
    try {
      const filePath = writeAgentMcpConfig(item.target, url, token);
      logger.info(`Wrote Torque MCP config for ${item.target.id}: ${filePath}`);
      configured.push(item.target.id);
      written.push(item.label);
    } catch (error) {
      logger.error(
        `Failed to write MCP config for ${item.target.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      failed.push(item.label);
    }
  }

  if (written.length > 0) {
    vscode.window.showInformationMessage(
      `Torque MCP server added to: ${written.join(", ")}. Restart the chat to pick it up.`
    );
  }

  if (failed.length > 0) {
    vscode.window.showErrorMessage(
      `Could not update: ${failed.join(", ")}. See the Torque AI output channel.`
    );
  }

  if (configured.length === 0) {
    return { agents: configured };
  }

  if (configured.length === 1) {
    return { agents: configured, primaryAgent: configured[0] };
  }

  const primary = await vscode.window.showQuickPick(
    configured.map((id) => {
      const target = AGENT_MCP_TARGETS.find((item) => item.id === id);
      return { label: target?.label ?? id, id };
    }),
    {
      title: "Which chat should Torque open from the environment page?",
      placeHolder: "Used when opening environment context from Torque"
    }
  );

  return { agents: configured, primaryAgent: primary?.id ?? configured[0] };
};
