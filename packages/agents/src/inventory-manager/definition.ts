import type { AgentDefinition } from "../../../core/src/types.js";

const THRESHOLD = Number(process.env.INVENTORY_ADJUSTMENT_APPROVAL_THRESHOLD ?? 5000);

export const inventoryManager: AgentDefinition = {
  id: "inventory-manager",
  displayName: "Inventory Manager",
  allowedTools: ["list_products", "get_product", "get_stock", "low_stock", "list_movements", "list_suppliers", "create_adjustment"],
  policy(tool, input) {
    if (tool === "create_adjustment") {
      const qty = Math.abs(Number(input.qty ?? 0));
      const unitCost = Number(input._unit_cost_php ?? 0); // agent is instructed to pass this from get_product
      const value = qty * unitCost;
      if (!input.reason || String(input.reason).length < 10) return { decision: "deny", reason: "Adjustment reason must be specific (>=10 chars)" };
      if (value >= THRESHOLD || unitCost === 0)
        return { decision: "needs_approval", reason: `Adjustment value ₱${value.toFixed(2)} (qty ${qty} × ₱${unitCost}) meets ₱${THRESHOLD} threshold` };
    }
    return { decision: "allow" };
  },
};
