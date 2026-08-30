import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { q } from "../../../core/src/index.js";

/** Auditor's view of the agents-VPS ledger + a way to file findings. Nothing here writes to HDS systems. */
export function auditorMcp(runId: string) {
  const j = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });
  return createSdkMcpServer({
    name: "audit",
    version: "1.0.0",
    tools: [
      tool("audit_agent_log", "Agent audit ledger entries since an ISO time (intent/policy/result/error per tool call).",
        { since: z.string(), agent_id: z.string().optional(), limit: z.number().default(500) },
        async ({ since, agent_id, limit }) => j(await q(
          "SELECT id,at,run_id,agent_id,phase,tool,input,output,policy_decision,policy_reason,approval_id FROM agent_audit WHERE at>=$1 AND ($2::text IS NULL OR agent_id=$2) ORDER BY at LIMIT $3",
          [since, agent_id ?? null, limit]))),
      tool("audit_approvals", "Approvals since an ISO time with who decided.", { since: z.string() },
        async ({ since }) => j(await q("SELECT * FROM approvals WHERE created_at>=$1 ORDER BY created_at", [since]))),
      tool("audit_runs", "Agent runs since an ISO time.", { since: z.string() },
        async ({ since }) => j(await q("SELECT * FROM agent_runs WHERE started_at>=$1 ORDER BY started_at", [since]))),
      tool("record_finding", "File an audit finding.",
        { severity: z.enum(["info", "warning", "critical"]), category: z.enum(["scope_violation", "ledger_mismatch", "unusual_amount", "policy_bypass", "stale_data"]), agent_id: z.string().optional(), description: z.string(), evidence: z.any().optional() },
        async (f) => j(await q("INSERT INTO auditor_findings (run_id,severity,category,agent_id,description,evidence) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
          [runId, f.severity, f.category, f.agent_id ?? null, f.description, f.evidence ?? null]))),
    ],
  });
}
