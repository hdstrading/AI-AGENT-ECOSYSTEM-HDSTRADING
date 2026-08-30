/**
 * MCP server for inventory.hdstradingopc.com.
 * Exposed in-process to agents via the Agent SDK (createSdkMcpServer). Tools map 1:1 to the OpenAPI contract.
 * Write tools exist but are gated: the agent's whitelist + policy + human approval decide if they ever fire.
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { HdsClient } from "../../core/src/hdsClient.js";

export function inventoryMcp(agentId: string, apiKey: string) {
  const api = new HdsClient(process.env.INVENTORY_API_URL!, apiKey, agentId);
  const j = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });

  return createSdkMcpServer({
    name: "inventory",
    version: "1.0.0",
    tools: [
      tool("list_products", "List products. Filter by brand (MAXX KLEAN | MISISPRO) or active.",
        { brand: z.string().optional(), active: z.boolean().optional(), page: z.number().optional(), limit: z.number().optional(), since: z.string().optional() },
        async (a) => j(await api.get("/products", a))),
      tool("get_product", "Get one product by id.", { id: z.string() }, async ({ id }) => j(await api.get(`/products/${id}`))),
      tool("get_stock", "Current stock levels; optional warehouse_id / product_id.",
        { warehouse_id: z.string().optional(), product_id: z.string().optional(), page: z.number().optional(), limit: z.number().optional() },
        async (a) => j(await api.get("/stock", a))),
      tool("low_stock", "Products at or below their reorder point.", {}, async () => j(await api.get("/stock/low"))),
      tool("list_movements", "Stock movements since an ISO date; optional product_id / type.",
        { since: z.string().optional(), product_id: z.string().optional(), type: z.string().optional(), page: z.number().optional(), limit: z.number().optional() },
        async (a) => j(await api.get("/movements", a))),
      tool("list_suppliers", "Suppliers with lead times.", { page: z.number().optional(), limit: z.number().optional() }, async (a) => j(await api.get("/suppliers", a))),
      tool("system_audit", "Inventory system's own change log (actor, before/after). Auditor cross-check.",
        { since: z.string().optional(), page: z.number().optional(), limit: z.number().optional() }, async (a) => j(await api.get("/audit", a))),
      // ---- WRITE (Phase 2) ----
      tool("create_adjustment", "Create a stock adjustment. GATED: large values require human approval.",
        { product_id: z.string(), warehouse_id: z.string(), qty: z.number(), reason: z.string().min(10), approved_by: z.string().optional() },
        async (a) => j(await api.post("/adjustments", a, `adj-${randomUUID()}`))),
    ],
  });
}
