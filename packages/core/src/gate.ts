import { AuditLogger } from "./audit.js";
import { requestApproval, waitForDecision } from "./approvals.js";
import type { AgentDefinition } from "./types.js";

/**
 * The single choke point. Wired into the Agent SDK's canUseTool hook, so every tool call
 * passes: intent -> whitelist -> policy -> (approval) -> execute. Nothing bypasses it.
 */
export function makeGate(def: AgentDefinition, runId: string) {
  const audit = new AuditLogger(runId, def.id);
  return async (toolName: string, input: Record<string, unknown>) => {
    await audit.intent(toolName, input);
    // Lazy match: server names may contain underscores (mcp__crm_notes__list_leads -> list_leads).
    const bare = toolName.replace(/^mcp__.+?__/, "");
    if (!def.allowedTools.includes(bare)) {
      const d = { decision: "deny" as const, reason: `Tool ${bare} is not whitelisted for ${def.id}` };
      await audit.policy(toolName, input, d);
      return { behavior: "deny" as const, message: d.reason };
    }
    const d = def.policy?.(bare, input) ?? { decision: "allow" as const };
    if (d.decision === "deny") {
      await audit.policy(toolName, input, d);
      return { behavior: "deny" as const, message: d.reason };
    }
    if (d.decision === "needs_approval") {
      const approvalId = await requestApproval(runId, def.id, bare, input, d.reason);
      await audit.policy(toolName, input, d, approvalId);
      const res = await waitForDecision(approvalId);
      if (res.status !== "approved")
        return { behavior: "deny" as const, message: `Approval #${approvalId} ${res.status}${res.decision_note ? ": " + res.decision_note : ""}` };
      return { behavior: "allow" as const, updatedInput: input };
    }
    await audit.policy(toolName, input, d);
    return { behavior: "allow" as const, updatedInput: input };
  };
}
