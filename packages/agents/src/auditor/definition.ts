import type { AgentDefinition } from "../../../core/src/types.js";
export const teamAuditor: AgentDefinition = {
  id: "team-auditor",
  displayName: "Team Auditor",
  // Read-only, always. Reads the agents' own ledger via audit_* tools and each system's /audit via system_audit.
  allowedTools: ["audit_agent_log", "audit_approvals", "audit_runs", "record_finding", "system_audit", "list_movements", "get_stock"],
  policy: () => ({ decision: "allow" }),
};
