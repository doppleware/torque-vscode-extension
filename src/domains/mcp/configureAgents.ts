import * as vscode from "vscode";
import { AGENT_MCP_TARGETS } from "../../ides/mcpConfigTargets";
import { logger } from "../../utils/Logger";
import { writeAgentMcpConfig } from "./writeAgentMcpConfig";
import { getPlatformName, getProductName, getTerm } from "../../branding";

export interface ConfiguredAgents {
  agents: string[];
  primaryAgent?: string;
}

export const promptAndConfigureAgents = async (
  url: string,
  token: string,
  preselected: string[] = []
): Promise<ConfiguredAgents | undefined> => {
  const usable = AGENT_MCP_TARGETS.filter(
    (target) => !target.isHostBound || target.isAvailable()
  );

  const available = usable.filter((target) => target.isAvailable());
  const unavailable = usable.filter((target) => !target.isAvailable());

  const items = [...available, ...unavailable].map((target) => ({
    label: target.label,
    description: target.isAvailable()
      ? target.description
      : `${target.description} (not detected here)`,
    picked:
      preselected.length > 0
        ? preselected.includes(target.id)
        : target.isAvailable(),
    target
  }));

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: "Which AI chats do you use?",
    placeHolder: `${getPlatformName()} will add its MCP server to the ones you select`
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
      logger.info(
        `Wrote ${getPlatformName()} MCP config for ${item.target.id}: ${filePath}`
      );
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
      `${getPlatformName()} MCP server added to: ${written.join(", ")}. Restart the chat to pick it up.`
    );
  }

  if (failed.length > 0) {
    vscode.window.showErrorMessage(
      `Could not update: ${failed.join(", ")}. See the ${getProductName()} output channel.`
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
      title: `Which chat should ${getPlatformName()} open from the ${getTerm("environment")} page?`,
      placeHolder: `Used when opening ${getTerm("environment")} context from ${getPlatformName()}`
    }
  );

  return { agents: configured, primaryAgent: primary?.id ?? configured[0] };
};
