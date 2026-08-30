import { q } from "./db/index.js";
import type { PolicyDecision } from "./types.js";

export class AuditLogger {
  constructor(private runId: string, private agentId: string) {}
  intent(tool: string, input: unknown) {
    return q("INSERT INTO agent_audit (run_id,agent_id,phase,tool,input) VALUES ($1,$2,'intent',$3,$4)", [this.runId, this.agentId, tool, input]);
  }
  policy(tool: string, input: unknown, d: PolicyDecision, approvalId?: number) {
    return q("INSERT INTO agent_audit (run_id,agent_id,phase,tool,input,policy_decision,policy_reason,approval_id) VALUES ($1,$2,'policy',$3,$4,$5,$6,$7)",
      [this.runId, this.agentId, tool, input, d.decision, "reason" in d ? d.reason : null, approvalId ?? null]);
  }
  result(tool: string, input: unknown, output: unknown) {
    return q("INSERT INTO agent_audit (run_id,agent_id,phase,tool,input,output) VALUES ($1,$2,'result',$3,$4,$5)", [this.runId, this.agentId, tool, input, output]);
  }
  error(tool: string | null, err: unknown) {
    return q("INSERT INTO agent_audit (run_id,agent_id,phase,tool,output) VALUES ($1,$2,'error',$3,$4)", [this.runId, this.agentId, tool, { message: String(err) }]);
  }
}
