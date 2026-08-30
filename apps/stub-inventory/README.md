# stub-inventory

A fixture-backed stand-in for `inventory.hdstradingopc.com`, implementing every endpoint the
inventory MCP calls, exactly as `api-spec/openapi.yaml` declares them.

It exists for two reasons:

1. **Phase 1 can run before Phase 0 ships.** Without it, every agent tool call hits an endpoint
   that does not exist yet, so nothing downstream — runner, gate, MCP, approval queue,
   orchestrator — can be exercised at all.
2. **It is the executable conformance reference for Phase 0.** Same paths, same field names,
   same `Paged` envelope, same error codes. Point `scripts/smoke-inventory.ts` at the real
   system when it is built and it becomes that implementation's acceptance test.

The stub mounts the **real** middleware from `api-spec/middleware/` rather than faking it, so
API-key auth, scope enforcement, idempotency and the `api_audit` ledger are genuinely
exercised — including the Fastify adaptation each real system will have to make.

## Run it

```bash
npm run dev:stub-inventory                       # http://127.0.0.1:4010
INVENTORY_API_URL=http://127.0.0.1:4010/api/v1 npm run smoke:inventory
```

Keys come from `AGENT_KEY_INVENTORY_MANAGER` and `AGENT_KEY_AUDITOR`. If either is unset the
stub mints a random one for that run and prints it at boot — set them in `.env` to keep them
stable across restarts. Scopes mirror what each agent legitimately needs:

| Agent | Scopes |
|---|---|
| `inventory-manager` | `inventory:read`, `inventory:write` |
| `team-auditor` | `inventory:read` — read-only by design, enforced server-side |

To run an actual agent against it, point the agents at the stub and supply an Anthropic key:

```bash
INVENTORY_API_URL=http://127.0.0.1:4010/api/v1 npm run agent:inventory -- "Daily stock health check"
```

## What the fixtures deliberately contain

The seed data is built so an agent run has something real to find, rather than a clean board:

| Condition | Where |
|---|---|
| Low stock (at/below reorder point) | `MK-DW-1L`@TACLOBAN, `MK-FC-4L`@TAYTAY, `MK-GC-20L`@TACLOBAN, `MP-TC-1L`@TAYTAY |
| Negative available (`reserved` > `on_hand`) | `MK-BC-500ML`@TAYTAY |
| Stale stock row (40d old, with recent movements) | `MP-HS-1L`@TAYTAY |
| Large adjustment (₱123,250, far over the gate) | movement `mv-0007` |
| Movement with no `reference` | movement `mv-0011` |
| System-ledger entry with no agent-ledger counterpart | audit `aud-0004` — the Team Auditor should raise `ledger_mismatch` |

## Deliberate deviations, and one open question

- **`/stock/low` response shape.** The contract types this endpoint's `data` as untyped, so the
  stub picks a shape: the stock level joined to its product and preferred supplier. Phase 0 must
  match it. It intentionally does *not* compute a suggested reorder quantity — that is the
  agent's job, and the Inventory Manager prompt requires it to show its math.
- **Threshold comparison.** `openapi.yaml` says `approved_by` is required when
  `abs(qty*cost) > threshold`, but the agent-side policy in
  `packages/agents/src/inventory-manager/definition.ts` gates at `>=`. The stub follows the
  agent (`>=`), the stricter of the two. Worth settling in the spec so Phase 0 does not
  inherit an off-by-one at exactly ₱5,000.

## Not production

In-memory state (lost on restart, and writes mutate the fixtures), no rate limiting, no TLS,
binds `127.0.0.1` by default. `api-spec/middleware/README.md` prescribes a `rateLimit()` in the
chain, but no such middleware exists in the scaffold yet — Phase 0 needs one written.
