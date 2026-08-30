# AI-AGENT-ECOSYSTEM-HDSTRADING (`hds-agents`) — AI agent ecosystem for HDS Trading OPC & Maxx Klean Tacloban

Core values baked in: **Integrity** (every action logged, two-ledger audit), **Team Work** (handoffs through the orchestrator),
**Client oriented** (Sr. Sales Agent owns the client thread).

## Layout
```
api-spec/            OpenAPI contract + drop-in middleware for the four HDS Node systems (Phase 0)
packages/core/       audit logger, policy gate, approval queue, HDS HTTP client, DB schema
packages/mcp-inventory/  MCP server for inventory.hdstradingopc.com
packages/agents/     one folder per agent: definition.ts (whitelist+policy), prompt.md, run.ts
apps/orchestrator/   Fastify: approvals inbox, runs, findings, triggers, daily schedule
infra/               docker-compose (Postgres + orchestrator + Caddy), Dockerfile, Caddyfile
docs/                Phase 0 plan
```

## Phase 1 quick start (agents VPS)
```bash
cp .env.example .env            # fill ANTHROPIC_API_KEY, DATABASE_URL, INVENTORY_API_URL, agent keys
npm install
npm run db:migrate
npm run agent:inventory -- "Daily stock health check"     # first agent run
npm run agent:auditor                                    # audits the last 24h
npm run dev:orchestrator                                 # http://localhost:4000
```

Approve or reject a gated action:
```bash
curl -H "Authorization: Bearer $ORCHESTRATOR_ADMIN_TOKEN" localhost:4000/approvals
curl -X POST -H "Authorization: Bearer $ORCHESTRATOR_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"by":"owner","note":"ok, counted physically"}' localhost:4000/approvals/1/approve
```

## Governance — how a tool call flows
```
agent wants tool ─► intent logged ─► whitelist? ─► policy (allow/deny/needs_approval)
      ─► [approval row, agent blocks until human decides] ─► execute ─► result logged
```
System side: API key scope + idempotency + api_audit. Auditor nightly compares both ledgers.

## Build sequence
0. Phase 0 — APIs on the four systems (docs/phase0-api-plan.md)
1. Foundation + Auditor + Inventory Manager  ← this scaffold
2. CRM + Website MCP → Lead Generator, Sr. Sales Agent
3. Accounting MCP → Cost Analyst
4. HR Admin  5. Payroll Admin (compute only)  6. Procurement  7. Hardening

## Adding an agent (the pattern)
1. `packages/mcp-<system>/` — tools mirror the OpenAPI contract
2. `packages/agents/src/<agent>/definition.ts` — `allowedTools` + `policy()`
3. `packages/agents/src/<agent>/prompt.md` — role, values, output format
4. `packages/agents/src/<agent>/run.ts` — wire runner + MCP
5. Register in `apps/orchestrator` SCRIPTS + schedule; issue a scoped API key on the system side

## Notes
- Verify `@anthropic-ai/claude-agent-sdk` option names (`canUseTool`, `mcpServers`, `createSdkMcpServer`) against the installed version's docs; this scaffold was typechecked against 0.3.x.
- Deploy: fifth IONOS VPS → `agents.hdstradingopc.com`, `docker compose -f infra/docker-compose.yml up -d`.
