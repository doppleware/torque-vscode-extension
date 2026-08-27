/**
 * Agent Chat Commands Test Suite
 *
 * Tests for resolving which AI chat the environment context should be sent to
 */

import * as assert from "assert";
import sinon from "sinon";
import vscode from "vscode";
import { resolveAgent } from "../../../ides/agentChatCommands";

suite("Agent Chat Commands Test Suite", () => {
  let sandbox: sinon.SinonSandbox;

  const stubAvailableCommands = (commands: string[]): void => {
    sandbox.stub(vscode.commands, "getCommands").resolves(commands);
  };

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite("resolveAgent", () => {
    test("Should prefer the primary agent when its commands exist", async () => {
      stubAvailableCommands([
        "claude-vscode.sidebar.open",
        "claude-vscode.insertAtMention",
        "kiroAgent.startNewChatSession",
        "kiroAgent.selectFilesAsContext"
      ]);

      const agent = await resolveAgent("claude-code", ["kiro"]);

      assert.strictEqual(agent, "claude-code");
    });

    test("Should skip an agent that can open chat but cannot attach a file", async () => {
      stubAvailableCommands([
        "workbench.action.chat.open",
        "kiroAgent.startNewChatSession",
        "kiroAgent.selectFilesAsContext"
      ]);

      const agent = await resolveAgent("copilot", ["kiro"]);

      assert.strictEqual(agent, "kiro");
    });

    test("Should fall back to a configured agent when there is no primary", async () => {
      stubAvailableCommands([
        "composer.startComposerPrompt",
        "composer.addfilestocomposer"
      ]);

      const agent = await resolveAgent(undefined, ["cursor"]);

      assert.strictEqual(agent, "cursor");
    });

    test("Should return undefined when no chat commands are available", async () => {
      stubAvailableCommands([]);

      const agent = await resolveAgent("claude-code", ["kiro", "cursor"]);

      assert.strictEqual(agent, undefined);
    });
  });
});
