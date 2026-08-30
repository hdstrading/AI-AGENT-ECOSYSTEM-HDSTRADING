/**
 * In-memory implementations of the three store interfaces the real systems must implement
 * against their own DB (see api-spec/middleware/README.md for the table definitions).
 * Everything here is process-local and lost on restart — that is the point of a stub.
 */
import { createHash, randomBytes } from "node:crypto";
import type { ApiKeyRecord, KeyStore } from "../../../api-spec/middleware/apiKeyAuth.js";
import type { IdemStore } from "../../../api-spec/middleware/idempotency.js";
import type { AuditStore } from "../../../api-spec/middleware/auditWrite.js";
import type { AuditEntry } from "./contract.js";
import { auditSeed } from "./fixtures.js";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface MintedKey { agent_id: string; raw: string; scopes: string[]; fromEnv: boolean }

/**
 * One key per agent, mirroring the scopes each agent legitimately needs.
 * team-auditor is read-only by design — the system rejects a write from it even if the
 * agent-side gate were bypassed. That independence is the whole point of two enforcement layers.
 */
const AGENTS: { agent_id: string; envVar: string; scopes: string[] }[] = [
  { agent_id: "inventory-manager", envVar: "AGENT_KEY_INVENTORY_MANAGER", scopes: ["inventory:read", "inventory:write"] },
  { agent_id: "team-auditor",      envVar: "AGENT_KEY_AUDITOR",           scopes: ["inventory:read"] },
];

export function makeKeyStore(): { store: KeyStore; minted: MintedKey[] } {
  const byHash = new Map<string, ApiKeyRecord>();
  const minted: MintedKey[] = [];
  for (const a of AGENTS) {
    const fromEnv = Boolean(process.env[a.envVar]);
    const raw = process.env[a.envVar] || `hds_stub_${randomBytes(24).toString("hex")}`;
    byHash.set(sha256(raw), { agent_id: a.agent_id, scopes: a.scopes, active: true });
    minted.push({ agent_id: a.agent_id, raw, scopes: a.scopes, fromEnv });
  }
  return {
    minted,
    store: {
      async findByHash(hash) { return byHash.get(hash) ?? null; },
      async touch() { /* last_used_at is not modelled in the stub */ },
    },
  };
}

export function makeIdemStore(): IdemStore {
  const rows = new Map<string, { agent_id: string; request_hash: string; response_code: number | null; response_body: unknown }>();
  return {
    async get(key) { return rows.get(key) ?? null; },
    async put(key, agent_id, request_hash) { rows.set(key, { agent_id, request_hash, response_code: null, response_body: null }); },
    async complete(key, code, body) {
      const r = rows.get(key);
      if (r) { r.response_code = code; r.response_body = body; }
    },
  };
}

export function makeAuditStore(): { store: AuditStore; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [...auditSeed];
  let n = entries.length;
  return {
    entries,
    store: {
      async record(e) {
        entries.push({
          id: `aud-${String(++n).padStart(4, "0")}`,
          at: new Date().toISOString(),
          actor: e.actor, action: e.action, resource: e.resource, resource_id: e.resource_id,
          before: e.before, after: e.after, idempotency_key: e.idempotency_key,
        });
      },
    },
  };
}
