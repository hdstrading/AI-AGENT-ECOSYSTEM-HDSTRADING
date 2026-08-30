import { runAgent } from "../runner.js";
import { teamAuditor } from "./definition.js";
import { auditorMcp } from "./tools.js";
import { inventoryMcp } from "../../../mcp-inventory/src/index.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const since = process.argv[2] ?? new Date(Date.now() - 24 * 3600_000).toISOString();
const runId = randomUUID(); // findings are tagged with this; runner creates its own run row
const res = await runAgent({
  def: teamAuditor,
  promptFile: join(dirname(fileURLToPath(import.meta.url)), "prompt.md"),
  task: `Audit the window since ${since}. Cross-check the agent ledger against the inventory system audit log.`,
  mcpServers: { audit: auditorMcp(runId), inventory: inventoryMcp("team-auditor", process.env.AGENT_KEY_AUDITOR!) },
});
console.log(`\n[audit run ${res.runId}]\n\n${res.summary}`);
process.exit(0);
