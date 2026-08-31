import os from "os";
import path from "path";
import vscode from "vscode";
import { getGlobalSettingsFolderPath } from "./getGlobalSettingsFolderPath";

export type AgentMcpConfigFormat = "json" | "toml";

export interface AgentMcpTarget {
  id: string;
  label: string;
  description: string;
  rootKey: string;
  format: AgentMcpConfigFormat;
  getFilePath: () => string;
  isAvailable: () => boolean;
  isHostBound: boolean;
}

const isRunningIn = (ideName: string): boolean =>
  vscode.env.appName === ideName;

const isExtensionInstalled = (extensionId: string): boolean =>
  vscode.extensions.getExtension(extensionId) !== undefined;

const getCodexHome = (): string =>
  process.env.CODEX_HOME && process.env.CODEX_HOME.length > 0
    ? process.env.CODEX_HOME
    : path.join(os.homedir(), ".codex");

export const AGENT_MCP_TARGETS: AgentMcpTarget[] = [
  {
    id: "copilot",
    label: "GitHub Copilot",
    description: "Visual Studio Code",
    rootKey: "servers",
    format: "json",
    getFilePath: () =>
      path.join(getGlobalSettingsFolderPath("Visual Studio Code"), "mcp.json"),
    isAvailable: () => isRunningIn("Visual Studio Code"),
    isHostBound: true
  },
  {
    id: "kiro",
    label: "Kiro",
    description: "Kiro built-in agent",
    rootKey: "mcpServers",
    format: "json",
    getFilePath: () => path.join(os.homedir(), ".kiro", "settings", "mcp.json"),
    isAvailable: () => isRunningIn("Kiro"),
    isHostBound: true
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "Cursor built-in agent",
    rootKey: "mcpServers",
    format: "json",
    getFilePath: () => path.join(os.homedir(), ".cursor", "mcp.json"),
    isAvailable: () => isRunningIn("Cursor"),
    isHostBound: true
  },
  {
    id: "claude-code",
    label: "Claude Code",
    description: "Claude Code in any editor",
    rootKey: "mcpServers",
    format: "json",
    getFilePath: () => path.join(os.homedir(), ".claude.json"),
    isAvailable: () => isExtensionInstalled("Anthropic.claude-code"),
    isHostBound: false
  },
  {
    id: "codex",
    label: "OpenAI Codex",
    description: "Codex CLI and IDE extension",
    rootKey: "mcp_servers",
    format: "toml",
    getFilePath: () => path.join(getCodexHome(), "config.toml"),
    isAvailable: () => isExtensionInstalled("openai.chatgpt"),
    isHostBound: false
  }
];
