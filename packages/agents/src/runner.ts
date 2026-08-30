import { query } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { makeGate, q, AuditLogger, type AgentDefinition } from "../../core/src/index.js";

export interface RunOptions { def: AgentDefinition; promptFile: string; task: string; mcpServers: Record<string, any>; maxTurns?: number }

/** Shared runner: registers the run, wires the gate, streams the agent, records summary + cost. */
export async function runAgent({ def, promptFile, task, mcpServers, maxTurns = 30 }: RunOptions) {
  const runId = randomUUID();
  const audit = new AuditLogger(runId, def.id);
  await q("INSERT INTO agent_runs (run_id,agent_id,task) VALUES ($1,$2,$3)", [runId, def.id, task]);
  const systemPrompt = readFileSync(promptFile, "utf8") + `\n\nRUN_ID: ${runId}\nNOW: ${new Date().toISOString()}`;
  let summary = ""; let cost: number | undefined;
  try {
    for await (const msg of query({
      prompt: task,
      options: {
        systemPrompt,
        mcpServers,
        allowedTools: Object.keys(mcpServers).flatMap(s => def.allowedTools.map(t => `mcp__${s}__${t}`)),
        canUseTool: makeGate(def, runId),
        maxTurns,
      },
    })) {
      if (msg.type === "assistant") {
        for (const block of (msg as any).message?.content ?? []) {
          if (block.type === "text") summary = block.text;
          if (block.type === "tool_use") await audit.result(block.name, block.input, null);
        }
      }
      if (msg.type === "result") { cost = (msg as any).total_cost_usd; if ((msg as any).result) summary = (msg as any).result; }
    }
    await q("UPDATE agent_runs SET status='done', finished_at=now(), summary=$2, cost_usd=$3 WHERE run_id=$1", [runId, summary, cost ?? null]);
  } catch (err) {
    await audit.error(null, err);
    await q("UPDATE agent_runs SET status='failed', finished_at=now(), summary=$2 WHERE run_id=$1", [runId, String(err)]);
    throw err;
  }
  return { runId, summary, cost };
}
