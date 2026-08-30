/**
 * Stub of inventory.hdstradingopc.com — implements every endpoint the inventory MCP calls,
 * exactly as api-spec/openapi.yaml declares them, backed by in-memory fixtures.
 *
 * Purpose:
 *  1. Lets the whole Phase 1 chain run before Phase 0 ships (runner -> gate -> MCP -> HTTP
 *     -> approval block -> orchestrator inbox).
 *  2. Doubles as the executable conformance reference for whoever implements Phase 0 on the
 *     real system: same paths, same field names, same Paged envelope, same error codes.
 *
 * It mounts the REAL middleware from api-spec/middleware/, so auth, scope, idempotency and
 * the api_audit ledger are exercised here rather than faked.
 *
 * NOT production: in-memory state, no rate limiting, no TLS. Binds localhost by default.
 */
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { apiKeyAuth, requireScope, ipAllowlist } from "../../../api-spec/middleware/apiKeyAuth.js";
import { idempotency } from "../../../api-spec/middleware/idempotency.js";
import { auditWrite } from "../../../api-spec/middleware/auditWrite.js";
import { makeKeyStore, makeIdemStore, makeAuditStore } from "./stores.js";
import { withChain, type Middleware } from "./shim.js";
import { paged, asInt, asBool, type StockMovement } from "./contract.js";
import { products, stock, movements, suppliers } from "./fixtures.js";

const PORT = Number(process.env.STUB_INVENTORY_PORT ?? 4010);
const HOST = process.env.STUB_INVENTORY_HOST ?? "127.0.0.1";
/** Same env var the agent-side policy reads, so both layers gate on the same number. */
const THRESHOLD = Number(process.env.INVENTORY_ADJUSTMENT_APPROVAL_THRESHOLD ?? 5000);

const { store: keyStore, minted } = makeKeyStore();
const idemStore = makeIdemStore();
const { store: auditStore, entries: auditEntries } = makeAuditStore();

const app = Fastify({ logger: { level: process.env.STUB_LOG_LEVEL ?? "warn" } });

const READ: Middleware[] = [ipAllowlist(), apiKeyAuth(keyStore), requireScope("inventory:read")];
const WRITE: Middleware[] = [
  ipAllowlist(), apiKeyAuth(keyStore), requireScope("inventory:write"),
  idempotency(idemStore), auditWrite(auditStore, "stock_movement"),
];

type Q = Record<string, string | undefined>;
const q = (r: { query: unknown }) => (r.query ?? {}) as Q;

// ---- common ----
app.get("/health", async () => ({ status: "ok", system: "inventory", version: "1.0.0-stub", time: new Date().toISOString() }));

app.get("/api/v1/audit", withChain(READ, (_req, res, request) => {
  const p = q(request);
  const rows = auditEntries
    .filter(e => !p.since || e.at >= p.since)
    .sort((a, b) => a.at.localeCompare(b.at));
  res.status(200).json(paged(rows, asInt(p.page, 1), asInt(p.limit, 50)));
}));

// ---- inventory reads ----
app.get("/api/v1/products", withChain(READ, (_req, res, request) => {
  const p = q(request);
  const active = asBool(p.active);
  const rows = products.filter(x =>
    (!p.brand || x.brand === p.brand) &&
    (active === undefined || x.active === active) &&
    (!p.since || (x.updated_at ?? "") >= p.since));
  res.status(200).json(paged(rows, asInt(p.page, 1), asInt(p.limit, 50)));
}));

app.get("/api/v1/products/:id", withChain(READ, (_req, res, request) => {
  const { id } = request.params as { id: string };
  const found = products.find(x => x.id === id || x.sku === id);
  if (!found) return res.status(404).json({ error: `Product ${id} not found`, code: "not_found" });
  res.status(200).json(found);
}));

app.get("/api/v1/stock", withChain(READ, (_req, res, request) => {
  const p = q(request);
  const rows = stock.filter(s =>
    (!p.warehouse_id || s.warehouse_id === p.warehouse_id) &&
    (!p.product_id || s.product_id === p.product_id));
  res.status(200).json(paged(rows, asInt(p.page, 1), asInt(p.limit, 50)));
}));

/**
 * Contract types /stock/low's `data` as untyped, so this is the stub's chosen shape and
 * Phase 0 must match it: stock level joined to its product and preferred supplier.
 * Deliberately does NOT compute a suggested reorder qty — that is the agent's job, and the
 * Inventory Manager prompt requires it to show its math.
 */
app.get("/api/v1/stock/low", withChain(READ, (_req, res) => {
  const rows = stock.flatMap(s => {
    const prod = products.find(x => x.id === s.product_id);
    if (!prod || !prod.active || prod.reorder_point === undefined) return [];
    if (s.available > prod.reorder_point) return [];
    const sup = suppliers.find(x => x.product_ids?.includes(prod.id));
    return [{
      product_id: prod.id, sku: prod.sku, name: prod.name, brand: prod.brand, unit: prod.unit,
      warehouse_id: s.warehouse_id, on_hand: s.on_hand, reserved: s.reserved, available: s.available,
      reorder_point: prod.reorder_point, cost_php: prod.cost_php,
      supplier_id: sup?.id ?? null, supplier_name: sup?.name ?? null, lead_time_days: sup?.lead_time_days ?? null,
      updated_at: s.updated_at,
    }];
  });
  res.status(200).json(paged(rows, 1, 200));
}));

app.get("/api/v1/movements", withChain(READ, (_req, res, request) => {
  const p = q(request);
  const rows = movements
    .filter(m => (!p.since || m.at >= p.since) && (!p.product_id || m.product_id === p.product_id) && (!p.type || m.type === p.type))
    .sort((a, b) => a.at.localeCompare(b.at));
  res.status(200).json(paged(rows, asInt(p.page, 1), asInt(p.limit, 50)));
}));

app.get("/api/v1/suppliers", withChain(READ, (_req, res, request) => {
  const p = q(request);
  res.status(200).json(paged(suppliers, asInt(p.page, 1), asInt(p.limit, 50)));
}));

// ---- inventory write ----
app.post("/api/v1/adjustments", withChain(WRITE, (req, res) => {
  const b = (req.body ?? {}) as Partial<{ product_id: string; warehouse_id: string; qty: number; reason: string; approved_by: string }>;
  if (!b.product_id || !b.warehouse_id || typeof b.qty !== "number" || Number.isNaN(b.qty))
    return res.status(400).json({ error: "product_id, warehouse_id and numeric qty are required", code: "validation" });
  if (!b.reason || b.reason.length < 10)
    return res.status(400).json({ error: "reason must be at least 10 characters", code: "validation" });

  const prod = products.find(x => x.id === b.product_id);
  if (!prod) return res.status(404).json({ error: `Product ${b.product_id} not found`, code: "not_found" });
  const level = stock.find(s => s.product_id === b.product_id && s.warehouse_id === b.warehouse_id);
  if (!level) return res.status(404).json({ error: `No stock record for ${b.product_id} at ${b.warehouse_id}`, code: "not_found" });

  // Server-side gate, independent of the agent-side policy. Defence in depth: even if an agent
  // prompt or its policy were wrong, an unapproved high-value adjustment cannot land here.
  const value = Math.abs(b.qty) * prod.cost_php;
  if (value >= THRESHOLD && !b.approved_by)
    return res.status(403).json({
      error: `Adjustment value PHP ${value.toFixed(2)} requires approved_by (threshold PHP ${THRESHOLD})`,
      code: "forbidden",
    });

  level.on_hand += b.qty;
  level.available = level.on_hand - level.reserved;
  level.updated_at = new Date().toISOString();

  const mv: StockMovement = {
    id: `mv-${String(movements.length + 1).padStart(4, "0")}`,
    product_id: b.product_id, warehouse_id: b.warehouse_id, qty: b.qty,
    type: "adjustment", reference: `ADJ-${randomUUID().slice(0, 8)}`, reason: b.reason,
    at: new Date().toISOString(), actor: `agent:${req.agent?.agent_id ?? "unknown"}`,
  };
  movements.push(mv);
  res.status(201).json(mv);
}));

const banner = minted.map(k =>
  `  ${k.agent_id.padEnd(18)} ${k.fromEnv ? "(from .env)" : k.raw}  scopes: ${k.scopes.join(", ")}`).join("\n");

await app.listen({ port: PORT, host: HOST });
console.log(`
stub-inventory listening on http://${HOST}:${PORT}
  point the agents at it:  INVENTORY_API_URL=http://${HOST}:${PORT}/api/v1
  adjustment threshold:    PHP ${THRESHOLD}
agent keys:
${banner}
${minted.some(k => !k.fromEnv) ? "  (keys above were minted for this run only - set them in .env to keep them stable)" : ""}`);
