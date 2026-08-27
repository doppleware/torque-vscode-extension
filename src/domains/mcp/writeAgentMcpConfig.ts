import fs from "fs";
import path from "path";
import type { AgentMcpTarget } from "../../ides/mcpConfigTargets";

const MCP_SERVER_NAME = "torque";

export const writeAgentMcpConfig = (
  target: AgentMcpTarget,
  url: string,
  token: string
): string => {
  const filePath = target.getFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let config: Record<string, unknown> = {};

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (raw.length > 0) {
      config = JSON.parse(raw) as Record<string, unknown>;
    }
  }

  const servers = (config[target.rootKey] ?? {}) as Record<string, unknown>;

  servers[MCP_SERVER_NAME] = {
    type: "http",
    url: `${url.replace(/\/+$/, "")}/mcp`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  config[target.rootKey] = servers;

  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  return filePath;
};
