import { q } from "./db/index.js";

export interface Approval { id: number; status: "pending" | "approved" | "rejected" | "expired"; decided_by: string | null; decision_note: string | null }

export async function requestApproval(runId: string, agentId: string, tool: string, input: unknown, reason: string): Promise<number> {
  const [row] = await q<{ id: number }>(
    "INSERT INTO approvals (run_id,agent_id,tool,input,reason) VALUES ($1,$2,$3,$4,$5) RETURNING id", [runId, agentId, tool, input, reason]);
  await q("UPDATE agent_runs SET status='awaiting_approval' WHERE run_id=$1", [runId]);
  return row.id;
}

export const getApproval = async (id: number) => (await q<Approval>("SELECT id,status,decided_by,decision_note FROM approvals WHERE id=$1", [id]))[0] ?? null;
export const listPending = () => q("SELECT * FROM approvals WHERE status='pending' ORDER BY created_at");

export async function decide(id: number, status: "approved" | "rejected", by: string, note?: string) {
  await q("UPDATE approvals SET status=$2, decided_by=$3, decided_at=now(), decision_note=$4 WHERE id=$1 AND status='pending'", [id, status, by, note ?? null]);
  return getApproval(id);
}

/** Poll until a human decides (or timeout). Agents block here — they never proceed on their own. */
export async function waitForDecision(id: number, timeoutMs = 24 * 3600_000, everyMs = 5_000): Promise<Approval> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const a = await getApproval(id);
    if (a && a.status !== "pending") return a;
    await new Promise(r => setTimeout(r, everyMs));
  }
  await q("UPDATE approvals SET status='expired' WHERE id=$1 AND status='pending'", [id]);
  return (await getApproval(id))!;
}
