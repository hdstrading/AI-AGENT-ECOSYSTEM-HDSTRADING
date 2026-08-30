/**
 * Seed data for the stub. Deliberately contains the conditions the Inventory Manager
 * and Team Auditor prompts are written to catch, so a run has something real to find:
 *
 *   LOW STOCK        MK-DW-1L@TACLOBAN, MK-FC-4L@TAYTAY, MK-GC-20L@TACLOBAN, MP-TC-1L@TAYTAY
 *   NEGATIVE AVAIL   MK-BC-500ML@TAYTAY (reserved 240 > on_hand 210)
 *   STALE STOCK      MP-HS-1L@TAYTAY (updated 40d ago, but has recent movements)
 *   LARGE ADJUSTMENT mv-0007, -85 x MK-GC-20L @ P1,450 = P123,250 (>> P5,000 gate)
 *   NO REFERENCE     mv-0011 (movement with no reference field)
 *   LEDGER MISMATCH  aud-0004 is actor=agent:inventory-manager with no matching row in the
 *                    agents-VPS ledger, so the Auditor should raise ledger_mismatch.
 */
import type { Product, StockLevel, StockMovement, Supplier, AuditEntry } from "./contract.js";

const iso = (daysAgo: number, hour = 9): string => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const WAREHOUSES = ["WH-TAYTAY", "WH-TACLOBAN"] as const;

export const products: Product[] = [
  { id: "prd-001", sku: "MK-DW-1L",    name: "Maxx Klean Dishwashing Liquid 1L",   brand: "MAXX KLEAN", category: "dishwashing",  unit: "L",   cost_php: 78.50,   price_php: 145.00,  reorder_point: 120, active: true,  updated_at: iso(3) },
  { id: "prd-002", sku: "MK-FC-4L",    name: "Maxx Klean Fabric Conditioner 4L",   brand: "MAXX KLEAN", category: "laundry",      unit: "gal", cost_php: 210.00,  price_php: 385.00,  reorder_point: 60,  active: true,  updated_at: iso(5) },
  { id: "prd-003", sku: "MK-BC-500ML", name: "Maxx Klean Bleach Concentrate 500ml", brand: "MAXX KLEAN", category: "disinfectant", unit: "pc",  cost_php: 42.75,   price_php: 89.00,   reorder_point: 200, active: true,  updated_at: iso(2) },
  { id: "prd-004", sku: "MK-GC-20L",   name: "Maxx Klean Glass Cleaner 20L Drum",  brand: "MAXX KLEAN", category: "glass",        unit: "L",   cost_php: 1450.00, price_php: 2350.00, reorder_point: 15,  active: true,  updated_at: iso(1) },
  { id: "prd-005", sku: "MP-HS-1L",    name: "MisisPro Hand Soap 1L",              brand: "MISISPRO",   category: "personal",     unit: "L",   cost_php: 95.00,   price_php: 175.00,  reorder_point: 100, active: true,  updated_at: iso(12) },
  { id: "prd-006", sku: "MP-TC-1L",    name: "MisisPro Toilet Cleaner 1L",         brand: "MISISPRO",   category: "bathroom",     unit: "L",   cost_php: 68.00,   price_php: 130.00,  reorder_point: 150, active: true,  updated_at: iso(4) },
  { id: "prd-007", sku: "MP-MS-5L",    name: "MisisPro Multi-Surface Cleaner 5L",  brand: "MISISPRO",   category: "general",      unit: "L",   cost_php: 320.00,  price_php: 560.00,  reorder_point: 40,  active: true,  updated_at: iso(6) },
  { id: "prd-008", sku: "OT-SPRY-PC",  name: "Trigger Spray Bottle 500ml",         brand: "OTHER",      category: "packaging",    unit: "pc",  cost_php: 18.00,   price_php: 45.00,   reorder_point: 500, active: true,  updated_at: iso(20) },
  { id: "prd-009", sku: "MK-AP-1L",    name: "Maxx Klean All-Purpose 1L (discontinued)", brand: "MAXX KLEAN", category: "general", unit: "L", cost_php: 88.00, price_php: 160.00, reorder_point: 0, active: false, updated_at: iso(95) },
];

export const stock: StockLevel[] = [
  { product_id: "prd-001", warehouse_id: "WH-TAYTAY",   on_hand: 340,  reserved: 60,  available: 280,  updated_at: iso(1) },
  { product_id: "prd-001", warehouse_id: "WH-TACLOBAN", on_hand: 95,   reserved: 20,  available: 75,   updated_at: iso(1) },
  { product_id: "prd-002", warehouse_id: "WH-TAYTAY",   on_hand: 48,   reserved: 12,  available: 36,   updated_at: iso(2) },
  { product_id: "prd-002", warehouse_id: "WH-TACLOBAN", on_hand: 120,  reserved: 10,  available: 110,  updated_at: iso(2) },
  { product_id: "prd-003", warehouse_id: "WH-TAYTAY",   on_hand: 210,  reserved: 240, available: -30,  updated_at: iso(1) },
  { product_id: "prd-003", warehouse_id: "WH-TACLOBAN", on_hand: 480,  reserved: 30,  available: 450,  updated_at: iso(3) },
  { product_id: "prd-004", warehouse_id: "WH-TAYTAY",   on_hand: 22,   reserved: 4,   available: 18,   updated_at: iso(1) },
  { product_id: "prd-004", warehouse_id: "WH-TACLOBAN", on_hand: 8,    reserved: 0,   available: 8,    updated_at: iso(1) },
  { product_id: "prd-005", warehouse_id: "WH-TAYTAY",   on_hand: 260,  reserved: 25,  available: 235,  updated_at: iso(40) },
  { product_id: "prd-006", warehouse_id: "WH-TAYTAY",   on_hand: 140,  reserved: 0,   available: 140,  updated_at: iso(2) },
  { product_id: "prd-007", warehouse_id: "WH-TAYTAY",   on_hand: 96,   reserved: 16,  available: 80,   updated_at: iso(3) },
  { product_id: "prd-008", warehouse_id: "WH-TAYTAY",   on_hand: 1450, reserved: 200, available: 1250, updated_at: iso(5) },
];

export const movements: StockMovement[] = [
  { id: "mv-0001", product_id: "prd-001", warehouse_id: "WH-TAYTAY",   qty:  600, type: "receipt",    reference: "PO-2026-0412", at: iso(28), actor: "human:u-ramon" },
  { id: "mv-0002", product_id: "prd-001", warehouse_id: "WH-TAYTAY",   qty: -180, type: "sale",       reference: "SO-2026-1188", at: iso(21), actor: "human:u-ramon" },
  { id: "mv-0003", product_id: "prd-001", warehouse_id: "WH-TACLOBAN", qty: -145, type: "sale",       reference: "SO-2026-1204", at: iso(14), actor: "human:u-joy" },
  { id: "mv-0004", product_id: "prd-002", warehouse_id: "WH-TAYTAY",   qty: -60,  type: "sale",       reference: "SO-2026-1219", at: iso(11), actor: "human:u-joy" },
  { id: "mv-0005", product_id: "prd-003", warehouse_id: "WH-TAYTAY",   qty:  400, type: "receipt",    reference: "PO-2026-0431", at: iso(9),  actor: "human:u-ramon" },
  { id: "mv-0006", product_id: "prd-003", warehouse_id: "WH-TAYTAY",   qty: -190, type: "sale",       reference: "SO-2026-1240", at: iso(6),  actor: "human:u-joy" },
  { id: "mv-0007", product_id: "prd-004", warehouse_id: "WH-TAYTAY",   qty: -85,  type: "adjustment", reference: "ADJ-2026-0077", reason: "Drum damage found during warehouse re-count", at: iso(5), actor: "human:u-ramon" },
  { id: "mv-0008", product_id: "prd-004", warehouse_id: "WH-TACLOBAN", qty: -7,   type: "sale",       reference: "SO-2026-1255", at: iso(4),  actor: "human:u-joy" },
  { id: "mv-0009", product_id: "prd-005", warehouse_id: "WH-TAYTAY",   qty: -40,  type: "sale",       reference: "SO-2026-1261", at: iso(3),  actor: "human:u-joy" },
  { id: "mv-0010", product_id: "prd-006", warehouse_id: "WH-TAYTAY",   qty: -95,  type: "sale",       reference: "SO-2026-1266", at: iso(2),  actor: "human:u-joy" },
  { id: "mv-0011", product_id: "prd-007", warehouse_id: "WH-TAYTAY",   qty: -24,  type: "transfer",   at: iso(2), actor: "human:u-ramon" },
  { id: "mv-0012", product_id: "prd-008", warehouse_id: "WH-TAYTAY",   qty:  1000, type: "receipt",   reference: "PO-2026-0444", at: iso(1),  actor: "human:u-ramon" },
];

export const suppliers: Supplier[] = [
  { id: "sup-001", name: "Rizal Chemical Supply Corp.", contact: "orders@rizalchem.ph", lead_time_days: 7,  product_ids: ["prd-001", "prd-003", "prd-009"] },
  { id: "sup-002", name: "Pacific Packaging Inc.",      contact: "sales@pacpack.ph",    lead_time_days: 14, product_ids: ["prd-008"] },
  { id: "sup-003", name: "Visayas Cleaning Solutions",  contact: "ops@viscleaning.ph",  lead_time_days: 10, product_ids: ["prd-002", "prd-004"] },
  { id: "sup-004", name: "Manila Home Care Distributors", contact: "purchasing@mhcd.ph", lead_time_days: 5, product_ids: ["prd-005", "prd-006", "prd-007"] },
];

/** Seeded system-side audit trail. aud-0004 has no agent-ledger counterpart on purpose. */
export const auditSeed: AuditEntry[] = [
  { id: "aud-0001", at: iso(9),  actor: "human:u-ramon", action: "create", resource: "stock_movement", resource_id: "mv-0005", after: { qty: 400, type: "receipt" } },
  { id: "aud-0002", at: iso(6),  actor: "human:u-joy",   action: "create", resource: "stock_movement", resource_id: "mv-0006", after: { qty: -190, type: "sale" } },
  { id: "aud-0003", at: iso(5),  actor: "human:u-ramon", action: "create", resource: "stock_movement", resource_id: "mv-0007", after: { qty: -85, type: "adjustment" } },
  { id: "aud-0004", at: iso(2),  actor: "agent:inventory-manager", action: "update", resource: "stock_level", resource_id: "prd-007:WH-TAYTAY", before: { on_hand: 120 }, after: { on_hand: 96 }, idempotency_key: "seed-orphan-entry-0004" },
];
