import { createHash } from "node:crypto";

export interface ApiKeyRecord { agent_id: string; scopes: string[]; active: boolean }
export interface KeyStore { findByHash(hash: string): Promise<ApiKeyRecord | null>; touch(hash: string): Promise<void> }

type Req = { headers: Record<string, string | string[] | undefined>; agent?: ApiKeyRecord };
type Res = { status(code: number): Res; json(body: unknown): void };
type Next = (err?: unknown) => void;

/** Bearer API key -> req.agent. One key per agent, hash stored server-side. */
export function apiKeyAuth(store: KeyStore) {
  return async (req: Req, res: Res, next: Next) => {
    const auth = String(req.headers["authorization"] ?? "");
    const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!raw) return res.status(401).json({ error: "Missing bearer token", code: "unauthorized" });
    const hash = createHash("sha256").update(raw).digest("hex");
    const rec = await store.findByHash(hash);
    if (!rec || !rec.active) return res.status(401).json({ error: "Invalid API key", code: "unauthorized" });
    req.agent = rec;
    void store.touch(hash);
    next();
  };
}

/** Scope check — the system rejects out-of-scope calls even if an agent prompt goes wrong. */
export function requireScope(scope: string) {
  return (req: Req, res: Res, next: Next) => {
    if (!req.agent?.scopes.includes(scope))
      return res.status(403).json({ error: `Scope ${scope} required`, code: "forbidden" });
    next();
  };
}

/** Only the agents VPS may call /api/v1. Set AGENTS_VPS_IPS="1.2.3.4,5.6.7.8". */
export function ipAllowlist(allowed = (process.env.AGENTS_VPS_IPS ?? "").split(",").map(s => s.trim()).filter(Boolean)) {
  return (req: Req & { ip?: string }, res: Res, next: Next) => {
    const ip = (String(req.headers["x-forwarded-for"] ?? "").split(",")[0] || req.ip || "").trim();
    if (allowed.length && !allowed.includes(ip))
      return res.status(403).json({ error: "IP not allowed", code: "forbidden" });
    next();
  };
}
