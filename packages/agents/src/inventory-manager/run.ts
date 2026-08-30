import { runAgent } from "../runner.js";
import { inventoryManager } from "./definition.js";
import { inventoryMcp } from "../../../mcp-inventory/src/index.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const task = process.argv.slice(2).join(" ") || "Run the daily stock health check for all warehouses.";
const res = await runAgent({
  def: inventoryManager,
  promptFile: join(dirname(fileURLToPath(import.meta.url)), "prompt.md"),
  task,
  mcpServers: { inventory: inventoryMcp("inventory-manager", process.env.AGENT_KEY_INVENTORY_MANAGER!) },
});
console.log(`\n[run ${res.runId}] cost $${res.cost ?? "?"}\n\n${res.summary}`);
process.exit(0);
