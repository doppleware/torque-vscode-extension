import vscode from "vscode";

export interface AgentChatCommands {
  openChat: string[];
  attachFile: string[];
  attachViaActiveEditor: boolean;
}

export const AGENT_CHAT_COMMANDS: Record<string, AgentChatCommands> = {
  copilot: {
    openChat: ["workbench.action.chat.open"],
    attachFile: ["workbench.action.chat.attachFile"],
    attachViaActiveEditor: false
  },
  kiro: {
    openChat: ["kiroAgent.startNewChatSession", "kiroAgent.focusChatInput"],
    attachFile: ["kiroAgent.selectFilesAsContext"],
    attachViaActiveEditor: false
  },
  cursor: {
    openChat: ["composer.startComposerPrompt"],
    attachFile: ["composer.addfilestocomposer"],
    attachViaActiveEditor: false
  },
  codex: {
    openChat: ["chatgpt.openSidebar", "chatgpt.newCodexPanel"],
    attachFile: ["chatgpt.addFileToThread"],
    attachViaActiveEditor: false
  },
  "claude-code": {
    openChat: ["claude-vscode.sidebar.open", "claude-vscode.newConversation"],
    attachFile: [
      "claude-vscode.insertAtMention",
      "claude-code.insertAtMentioned"
    ],
    attachViaActiveEditor: true
  }
};

const AGENT_BY_IDE_NAME: Record<string, string> = {
  "Visual Studio Code": "copilot",
  Kiro: "kiro",
  Cursor: "cursor"
};

export const getFirstAvailableCommand = async (
  candidates: string[]
): Promise<string | undefined> => {
  const available = new Set(await vscode.commands.getCommands(true));
  return candidates.find((command) => available.has(command));
};

export const resolveAgent = async (
  primaryAgent: string | undefined,
  configuredAgents: string[]
): Promise<string | undefined> => {
  const fallback = AGENT_BY_IDE_NAME[vscode.env.appName];
  const ordered = [primaryAgent, ...configuredAgents, fallback].filter(
    (agent): agent is string => agent !== undefined
  );

  for (const agent of ordered) {
    const commands = AGENT_CHAT_COMMANDS[agent];
    if (!commands) {
      continue;
    }

    const openChat = await getFirstAvailableCommand(commands.openChat);
    const attachFile = await getFirstAvailableCommand(commands.attachFile);

    if (openChat && attachFile) {
      return agent;
    }
  }
};
