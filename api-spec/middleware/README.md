# Drop-in middleware for the four HDS Node systems

Copy this folder into each system (inventory, crm, accounting, payroll) and mount under `/api/v1`.
Written for Express-style `(req, res, next)`; adapt the two lines that read headers/IP if you use Fastify/Koa.

Order of middleware on every `/api/v1/*` route:

```ts
app.use('/api/v1', ipAllowlist(), apiKeyAuth(db), rateLimit());
router.get('/products', requireScope('inventory:read'), handler);
router.post('/adjustments', requireScope('inventory:write'), idempotency(db), auditWrite(db, 'stock_movement'), handler);
```

Table you need in each system (Postgres/MySQL — same columns):

```sql
CREATE TABLE api_keys (
  id            SERIAL PRIMARY KEY,
  agent_id      TEXT NOT NULL,            -- e.g. 'inventory-manager'
  key_hash      TEXT NOT NULL UNIQUE,     -- sha256 of the raw key; raw key shown once
  scopes        TEXT[] NOT NULL,          -- {'inventory:read','inventory:write'}
  active        BOOLEAN NOT NULL DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE idempotency_keys (
  key           TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  request_hash  TEXT NOT NULL,
  response_code INT,
  response_body JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE api_audit (
  id            BIGSERIAL PRIMARY KEY,
  at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor         TEXT NOT NULL,            -- 'agent:<id>' or 'human:<user_id>'
  action        TEXT NOT NULL,            -- create|update|delete
  resource      TEXT NOT NULL,
  resource_id   TEXT,
  before        JSONB,
  after         JSONB,
  idempotency_key TEXT
);
```

Generate a key: `node -e "const c=require('crypto');const k='hds_'+c.randomBytes(32).toString('hex');console.log(k, c.createHash('sha256').update(k).digest('hex'))"`
Store the hash in `api_keys`; paste the raw key into the agents VPS `.env` once.
