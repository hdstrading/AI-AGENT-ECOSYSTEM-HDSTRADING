# Phase 0 — Add the API to each HDS system (Node)

Same recipe for inventory, crm, accounting, payroll. Estimate: 2–4 dev-days per system for read endpoints.

## Per system
1. Run the three `CREATE TABLE` statements in `api-spec/middleware/README.md`.
2. Copy `api-spec/middleware/*.ts` into the system, implement the three tiny store interfaces (`KeyStore`, `IdemStore`, `AuditStore`) against your DB.
3. Mount `/api/v1` with `ipAllowlist() → apiKeyAuth() → rateLimit()`.
4. Implement `GET /health` and `GET /audit` (common to all four).
5. Implement the read resources below. Match field names in `openapi.yaml` exactly — the MCP servers depend on them.
6. Issue keys: one per agent that will touch this system, scoped read-only for now.
7. Set `AGENTS_VPS_IPS` to the agents VPS public IP.

## Read resources (Phase 0)
| System | Resources |
|---|---|
| inventory | products, stock, stock/low, movements, suppliers |
| crm | contacts, accounts, deals, activities, quotes |
| accounting | invoices, payments, expenses, cogs (by product), ar-aging |
| payroll | employees, attendance, pay-periods, deductions-config |

## Write resources (added only when that agent's phase starts)
| System | Resource | Gate |
|---|---|---|
| inventory | POST /adjustments | approval above ₱ threshold |
| crm | POST /leads, POST /quotes (status=draft), POST /activities | quotes: approval before send |
| accounting | POST /expenses (draft), POST /purchase-orders (draft) | every PO |
| payroll | POST /pay-runs/compute (never /finalize) | every run |

## Scopes
`inventory:read inventory:write crm:read crm:write accounting:read accounting:write payroll:read payroll:compute`
Payroll deliberately has no `write` scope — computation only, finalization stays human.
