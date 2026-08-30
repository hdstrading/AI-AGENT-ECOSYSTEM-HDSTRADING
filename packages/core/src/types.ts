export type AgentId =
  | "team-auditor" | "inventory-manager" | "sr-sales-agent" | "lead-generator"
  | "cost-analyst" | "procurement-agent" | "hr-admin" | "payroll-admin";

export type PolicyDecision = { decision: "allow" } | { decision: "deny"; reason: string } | { decision: "needs_approval"; reason: string };

export interface AgentDefinition {
  id: AgentId;
  displayName: string;
  /** Tools this agent may ever call. Anything else is denied before it reaches a system. */
  allowedTools: string[];
  /** Per-tool policy; default allow. */
  policy?: (tool: string, input: Record<string, unknown>) => PolicyDecision;
}
