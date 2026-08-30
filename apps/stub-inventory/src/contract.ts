/**
 * TypeScript mirror of api-spec/openapi.yaml. Field names here are the contract —
 * the MCP servers and agent prompts depend on them, so Phase 0 implementations
 * on the real systems must match these exactly.
 */
export type Brand = "MAXX KLEAN" | "MISISPRO" | "OTHER";
export type MovementType = "receipt" | "sale" | "adjustment" | "transfer" | "return" | "production";
export type ErrorCode = "unauthorized" | "forbidden" | "not_found" | "validation" | "conflict" | "rate_limited" | "internal";

export interface Product {
  id: string; sku: string; name: string; brand: Brand; category?: string;
  unit: string; cost_php: number; price_php: number; reorder_point?: number; active: boolean;
  updated_at?: string;
}

export interface StockLevel {
  product_id: string; warehouse_id: string;
  on_hand: number; reserved: number; available: number; updated_at?: string;
}

export interface StockMovement {
  id: string; product_id: string; warehouse_id: string; qty: number;
  type: MovementType; reference?: string; reason?: string; at: string; actor: string;
}

export interface Supplier {
  id: string; name: string; contact?: string; lead_time_days?: number; product_ids?: string[];
}

export interface AuditEntry {
  id: string; at: string; actor: string; action: "create" | "update" | "delete";
  resource: string; resource_id?: string; before?: unknown; after?: unknown; idempotency_key?: string;
}

export interface Paged<T> { data: T[]; page: number; limit: number; total: number }

/** Slice into the Paged envelope. `total` is the count BEFORE slicing, per the contract. */
export function paged<T>(rows: T[], page = 1, limit = 50): Paged<T> {
  const p = Math.max(1, Math.floor(page) || 1);
  const l = Math.min(200, Math.max(1, Math.floor(limit) || 50));
  return { data: rows.slice((p - 1) * l, p * l), page: p, limit: l, total: rows.length };
}

/** Query values arrive as strings over HTTP; the contract types them as int/bool. */
export const asInt = (v: unknown, d: number): number => {
  const n = Number(v); return Number.isFinite(n) ? n : d;
};
export const asBool = (v: unknown): boolean | undefined =>
  v === undefined || v === "" ? undefined : v === "true" || v === true;
