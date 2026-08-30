/**
 * Agent MCP Config Writer Test Suite
 *
 * Tests for writing the Torque MCP server into each agent's own config file
 */

import * as assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import type { AgentMcpTarget } from "../../../ides/mcpConfigTargets";
import { writeAgentMcpConfig } from "../../../domains/mcp/writeAgentMcpConfig";

suite("Agent MCP Config Writer Test Suite", () => {
  let tempDir: string;

  const createTarget = (
    rootKey: string,
    fileName = "mcp.json"
  ): AgentMcpTarget => ({
    id: "test-agent",
    label: "Test Agent",
    description: "Test",
    rootKey,
    getFilePath: () => path.join(tempDir, fileName)
  });

  interface McpConfigFile {
    servers?: Record<string, McpServerEntry>;
    mcpServers?: Record<string, McpServerEntry>;
    someOtherSetting?: string;
  }

  interface McpServerEntry {
    type?: string;
    url?: string;
    headers?: Record<string, string>;
    autoApprove?: string[];
  }

  const readConfig = (filePath: string): McpConfigFile =>
    JSON.parse(fs.readFileSync(filePath, "utf8")) as McpConfigFile;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "torque-mcp-test-"));
  });

  teardown(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("Should create the config file when it does not exist", () => {
    const target = createTarget("mcpServers");

    const filePath = writeAgentMcpConfig(
      target,
      "http://localhost",
      "token-1234567890"
    );

    assert.ok(fs.existsSync(filePath));
    const config = readConfig(filePath);
    assert.deepStrictEqual(config.mcpServers?.torque, {
      type: "http",
      url: "http://localhost/mcp",
      headers: { Authorization: "Bearer token-1234567890" }
    });
  });

  test("Should use the servers root key for VS Code style configs", () => {
    const target = createTarget("servers");

    const filePath = writeAgentMcpConfig(
      target,
      "http://localhost",
      "token-1234567890"
    );

    const config = readConfig(filePath);
    assert.ok(config.servers?.torque);
    assert.strictEqual(config.mcpServers, undefined);
  });

  test("Should preserve other MCP servers already in the file", () => {
    const target = createTarget("mcpServers");
    const filePath = target.getFilePath();
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        mcpServers: { existing: { url: "http://example.com/mcp" } }
      }),
      "utf8"
    );

    writeAgentMcpConfig(target, "http://localhost", "token-1234567890");

    const config = readConfig(filePath);
    assert.strictEqual(
      config.mcpServers?.existing.url,
      "http://example.com/mcp"
    );
    assert.ok(config.mcpServers?.torque);
  });

  test("Should preserve unrelated top level keys in the file", () => {
    const target = createTarget("mcpServers");
    const filePath = target.getFilePath();
    fs.writeFileSync(
      filePath,
      JSON.stringify({ someOtherSetting: "keep me" }),
      "utf8"
    );

    writeAgentMcpConfig(target, "http://localhost", "token-1234567890");

    const config = readConfig(filePath);
    assert.strictEqual(config.someOtherSetting, "keep me");
    assert.ok(config.mcpServers?.torque);
  });

  test("Should replace the Torque entry instead of duplicating it", () => {
    const target = createTarget("mcpServers");

    writeAgentMcpConfig(target, "http://localhost", "old-token-123456");
    const filePath = writeAgentMcpConfig(
      target,
      "http://localhost",
      "new-token-123456"
    );

    const config = readConfig(filePath);
    assert.strictEqual(Object.keys(config.mcpServers ?? {}).length, 1);
    assert.strictEqual(
      config.mcpServers?.torque.headers?.Authorization,
      "Bearer new-token-123456"
    );
  });

  test("Should reuse an existing entry pointing at the same server", () => {
    const target = createTarget("mcpServers");
    const filePath = target.getFilePath();
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        mcpServers: {
          "stack-automation": {
            type: "http",
            url: "http://localhost/mcp",
            headers: { Authorization: "Bearer old-token-123456" }
          }
        }
      }),
      "utf8"
    );

    writeAgentMcpConfig(target, "http://localhost", "new-token-123456");

    const config = readConfig(filePath);
    assert.strictEqual(Object.keys(config.mcpServers ?? {}).length, 1);
    assert.strictEqual(
      config.mcpServers?.["stack-automation"].headers?.Authorization,
      "Bearer new-token-123456"
    );
    assert.strictEqual(config.mcpServers?.torque, undefined);
  });

  test("Should keep extra settings on the entry it reuses", () => {
    const target = createTarget("mcpServers");
    const filePath = target.getFilePath();
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        mcpServers: {
          torque: {
            type: "http",
            url: "http://localhost/mcp",
            autoApprove: ["get_spaces"]
          }
        }
      }),
      "utf8"
    );

    writeAgentMcpConfig(target, "http://localhost", "token-1234567890");

    const config = readConfig(filePath);
    assert.deepStrictEqual(config.mcpServers?.torque.autoApprove, [
      "get_spaces"
    ]);
  });

  test("Should not double the slash when the url has a trailing slash", () => {
    const target = createTarget("mcpServers");

    const filePath = writeAgentMcpConfig(
      target,
      "http://localhost/",
      "token-1234567890"
    );

    const config = readConfig(filePath);
    assert.strictEqual(config.mcpServers?.torque.url, "http://localhost/mcp");
  });

  test("Should create missing parent directories", () => {
    const target = createTarget("mcpServers", path.join("nested", "mcp.json"));

    const filePath = writeAgentMcpConfig(
      target,
      "http://localhost",
      "token-1234567890"
    );

    assert.ok(fs.existsSync(filePath));
  });
});
