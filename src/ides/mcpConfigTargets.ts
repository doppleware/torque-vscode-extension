import os from "os";
import path from "path";
import { getGlobalSettingsFolderPath } from "./getGlobalSettingsFolderPath";

export interface AgentMcpTarget {
  id: string;
  label: string;
  description: string;
  rootKey: string;
  getFilePath: () => string;
}

export const AGENT_MCP_TARGETS: AgentMcpTarget[] = [
  {
    id: "copilot",
    label: "GitHub Copilot",
    description: "Visual Studio Code",
    rootKey: "servers",
    getFilePath: () =>
      path.join(getGlobalSettingsFolderPath("Visual Studio Code"), "mcp.json")
  },
  {
    id: "kiro",
    label: "Kiro",
    description: "Kiro built-in agent",
    rootKey: "mcpServers",
    getFilePath: () => path.join(os.homedir(), ".kiro", "settings", "mcp.json")
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "Cursor built-in agent",
    rootKey: "mcpServers",
    getFilePath: () => path.join(os.homedir(), ".cursor", "mcp.json")
  },
  {
    id: "claude-code",
    label: "Claude Code",
    description: "Claude Code in any editor",
    rootKey: "mcpServers",
    getFilePath: () => path.join(os.homedir(), ".claude.json")
  }
];
