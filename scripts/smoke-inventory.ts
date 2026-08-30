/**
 * Conformance check for the inventory API contract (api-spec/openapi.yaml).
 *
 * Runs against the stub today; point INVENTORY_API_URL at the real system once Phase 0 ships
 * and it becomes the acceptance test for that implementation. Read-only except for the
 * /adjustments cases, which is why it must never be aimed at production.
 *
 *   npm run smoke:inventory
 */
const BASE = process.env.INVENTORY_API_URL ?? "http://127.0.0.1:4010/api/v1";
const MGR = process.env.AGENT_KEY_INVENTORY_MANAGER ?? "";
const AUD = process.env.AGENT_KEY_AUDITOR ?? "";

let pass = 0, fail = 0;
const results: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; results.push(`  PASS  ${name}`); }
  else { fail++; results.push(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`); }
}

async function call(path: string, opts: { key?: string; method?: string; body?: unknown; idem?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.key) headers.Authorization = `Bearer ${opts.key}`;
  if (opts.idem) headers["Idempotency-Key"] = opts.idem;
  const r = await fetch(BASE + path, {
    method: opts.method ?? "GET", headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await r.text();
  let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, json };
}

const isPaged = (j: any) => j && Array.isArray(j.data) && typeof j.page === "number" && typeof j.limit === "number" && typeof j.total === "number";
const key = (n: string) => `smoke-${n}-${"x".repeat(16)}`;

// ---- common ----
{
  const r = await fetch(BASE.replace(/\/api\/v1$/, "") + "/health");
  const j: any = await r.json();
  check("GET /health is unauthenticated and reports the system", r.status === 200 && j.status === "ok" && j.system === "inventory", `got ${r.status} ${JSON.stringify(j)}`);
}

// ---- auth + scope ----
check("GET /products without a key is 401", (await call("/products")).status === 401);
check("GET /products with a bogus key is 401", (await call("/products", { key: "hds_not_a_real_key" })).status === 401);

// ---- reads ----
{
  const { status, json } = await call("/products", { key: MGR });
  check("GET /products returns the Paged envelope", status === 200 && isPaged(json), `got ${status}`);
  const p = json.data?.[0];
  check("Product carries every required contract field",
    !!p && ["id", "sku", "name", "brand", "unit", "cost_php", "price_php", "active"].every(f => p[f] !== undefined),
    `got ${JSON.stringify(p)}`);
}
{
  const { json } = await call("/products?brand=MISISPRO", { key: MGR });
  check("GET /products?brand filters", json.data?.length > 0 && json.data.every((x: any) => x.brand === "MISISPRO"));
}
{
  const { json } = await call("/products?active=false", { key: MGR });
  check("GET /products?active=false parses the boolean from the query string",
    json.data?.length > 0 && json.data.every((x: any) => x.active === false), `got ${json.data?.length} rows`);
}
{
  const { status, json } = await call("/products/prd-001", { key: MGR });
  check("GET /products/{id} returns a bare Product, not a page", status === 200 && json.id === "prd-001" && json.data === undefined);
}
{
  const { status, json } = await call("/products/prd-does-not-exist", { key: MGR });
  check("GET /products/{id} 404s with the contract error code", status === 404 && json.code === "not_found", `got ${status} ${JSON.stringify(json)}`);
}
{
  const { json } = await call("/stock?warehouse_id=WH-TACLOBAN", { key: MGR });
  check("GET /stock?warehouse_id filters", json.data?.length > 0 && json.data.every((x: any) => x.warehouse_id === "WH-TACLOBAN"));
}
{
  const { status, json } = await call("/stock/low", { key: MGR });
  const skus: string[] = (json.data ?? []).map((x: any) => x.sku);
  check("GET /stock/low returns rows at or below reorder point", status === 200 && isPaged(json) && json.data.length > 0);
  check("GET /stock/low joins product + supplier detail the agent needs",
    json.data?.[0] && ["sku", "available", "reorder_point", "supplier_name", "lead_time_days"].every(f => f in json.data[0]));
  check("GET /stock/low excludes inactive products", !skus.includes("MK-AP-1L"));
}
{
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { json } = await call(`/movements?since=${encodeURIComponent(since)}`, { key: MGR });
  check("GET /movements?since filters by date", json.data?.length > 0 && json.data.every((m: any) => m.at >= since));
}
{
  const { json } = await call("/movements?type=adjustment", { key: MGR });
  check("GET /movements?type filters", json.data?.every((m: any) => m.type === "adjustment"));
}
check("GET /suppliers returns a page", isPaged((await call("/suppliers", { key: MGR })).json));
{
  const { status, json } = await call("/audit", { key: AUD });
  check("GET /audit is readable by the read-only auditor key", status === 200 && isPaged(json), `got ${status}`);
  check("AuditEntry carries actor/action/resource", json.data?.[0] && ["id", "at", "actor", "action", "resource"].every(f => f in json.data[0]));
}

// ---- scope enforcement ----
{
  const { status, json } = await call("/adjustments", {
    key: AUD, method: "POST", idem: key("scope"),
    body: { product_id: "prd-008", warehouse_id: "WH-TAYTAY", qty: 1, reason: "auditor should never be able to write" },
  });
  check("POST /adjustments with the read-only auditor key is 403", status === 403 && json.code === "forbidden", `got ${status} ${JSON.stringify(json)}`);
}

// ---- idempotency ----
{
  const k = key("small");
  const body = { product_id: "prd-008", warehouse_id: "WH-TAYTAY", qty: -10, reason: "Damaged spray triggers found during cycle count" };
  const first = await call("/adjustments", { key: MGR, method: "POST", idem: k, body });
  check("POST /adjustments below threshold returns 201 + StockMovement",
    first.status === 201 && first.json.type === "adjustment" && first.json.actor === "agent:inventory-manager",
    `got ${first.status} ${JSON.stringify(first.json)}`);

  const replay = await call("/adjustments", { key: MGR, method: "POST", idem: k, body });
  check("Replaying the same Idempotency-Key + payload returns the stored response",
    replay.status === 201 && replay.json.id === first.json.id, `got ${replay.status} ${JSON.stringify(replay.json)}`);

  const conflict = await call("/adjustments", { key: MGR, method: "POST", idem: k, body: { ...body, qty: -11 } });
  check("Reusing an Idempotency-Key with a different payload is 409",
    conflict.status === 409 && conflict.json.code === "conflict", `got ${conflict.status} ${JSON.stringify(conflict.json)}`);
}

// ---- validation + the approval gate ----
{
  const { status, json } = await call("/adjustments", {
    key: MGR, method: "POST", idem: key("reason"),
    body: { product_id: "prd-008", warehouse_id: "WH-TAYTAY", qty: -1, reason: "typo" },
  });
  check("POST /adjustments rejects a reason under 10 chars", status === 400 && json.code === "validation", `got ${status}`);
}
{
  const body = { product_id: "prd-004", warehouse_id: "WH-TAYTAY", qty: -10, reason: "Glass cleaner drums written off after pallet collapse" };
  const denied = await call("/adjustments", { key: MGR, method: "POST", idem: key("bigno"), body });
  check("High-value adjustment WITHOUT approved_by is refused by the system",
    denied.status === 403 && denied.json.code === "forbidden", `got ${denied.status} ${JSON.stringify(denied.json)}`);

  const allowed = await call("/adjustments", { key: MGR, method: "POST", idem: key("bigyes"), body: { ...body, approved_by: "human:u-owner" } });
  check("High-value adjustment WITH approved_by succeeds",
    allowed.status === 201 && allowed.json.qty === -10, `got ${allowed.status} ${JSON.stringify(allowed.json)}`);
}

// ---- the write actually moved stock, and landed in the system ledger ----
{
  const { json } = await call("/stock?product_id=prd-008&warehouse_id=WH-TAYTAY", { key: MGR });
  const lvl = json.data?.[0];
  check("Adjustment mutated on_hand and recomputed available",
    lvl && lvl.on_hand === 1440 && lvl.available === lvl.on_hand - lvl.reserved, `got ${JSON.stringify(lvl)}`);
}
{
  const { json } = await call("/audit?limit=200", { key: AUD });
  const agentWrites = (json.data ?? []).filter((e: any) => e.actor === "agent:inventory-manager");
  check("auditWrite recorded the agent's writes into the system ledger",
    agentWrites.length >= 3, `found ${agentWrites.length} agent entries`);
  check("Audit entries carry the idempotency key used for the write",
    agentWrites.some((e: any) => typeof e.idempotency_key === "string" && e.idempotency_key.startsWith("smoke-")));
}

console.log(`\nconformance: ${BASE}\n${results.join("\n")}\n\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
