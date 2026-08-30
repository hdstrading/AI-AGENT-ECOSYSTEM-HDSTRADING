/**
 * Orchestrator: approval queue API + scheduled runs + manual triggers.
 * Phase 1 keeps it small; BullMQ/Redis and the dashboard come in Phase 2 once there are >2 agents.
 */
import Fastify from "fastify";
import { spawn } from "node:child_process";
import { listPending, decide, q } from "../../../packages/core/src/index.js";

const app = Fastify({ logger: true });
const ADMIN = process.env.ORCHESTRATOR_ADMIN_TOKEN!;

app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/health") return;
  if (req.headers.authorization !== `Bearer ${ADMIN}`) return reply.code(401).send({ error: "unauthorized" });
});

app.get("/health", async () => ({ status: "ok", time: new Date().toISOString() }));

// ---- Approvals (the owner's inbox) ----
app.get("/approvals", async () => listPending());
app.post<{ Params: { id: string }; Body: { by: string; note?: string } }>("/approvals/:id/approve", async (req) =>
  decide(Number(req.params.id), "approved", req.body.by, req.body.note));
app.post<{ Params: { id: string }; Body: { by: string; note?: string } }>("/approvals/:id/reject", async (req) =>
  decide(Number(req.params.id), "rejected", req.body.by, req.body.note));

// ---- Visibility ----
app.get("/runs", async () => q("SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 50"));
app.get("/findings", async () => q("SELECT * FROM auditor_findings WHERE resolved=false ORDER BY at DESC"));
app.get<{ Params: { runId: string } }>("/runs/:runId/audit", async (req) =>
  q("SELECT * FROM agent_audit WHERE run_id=$1 ORDER BY at", [req.params.runId]));

// ---- Triggers ----
const SCRIPTS: Record<string, string> = { "inventory-manager": "agent:inventory", "team-auditor": "agent:auditor" };
app.post<{ Params: { agent: string }; Body: { task?: string } }>("/agents/:agent/run", async (req, reply) => {
  const script = SCRIPTS[req.params.agent];
  if (!script) return reply.code(404).send({ error: "unknown agent" });
  const child = spawn("npm", ["run", "-s", script, "--", req.body?.task ?? ""], { stdio: "inherit", env: process.env });
  return { started: true, pid: child.pid, agent: req.params.agent };
});

// ---- Schedule (simple; replace with BullMQ repeatable jobs in Phase 2) ----
function daily(hourPH: number, fn: () => void) {
  const tick = () => {
    const now = new Date(Date.now() + 8 * 3600_000); // Asia/Manila
    if (now.getUTCHours() === hourPH && now.getUTCMinutes() === 0) fn();
  };
  setInterval(tick, 60_000);
}
daily(7, () => spawn("npm", ["run", "-s", "agent:inventory"], { stdio: "inherit", env: process.env }));   // 07:00 stock health
daily(22, () => spawn("npm", ["run", "-s", "agent:auditor"], { stdio: "inherit", env: process.env }));    // 22:00 nightly audit

app.listen({ port: Number(process.env.ORCHESTRATOR_PORT ?? 4000), host: "0.0.0.0" });
