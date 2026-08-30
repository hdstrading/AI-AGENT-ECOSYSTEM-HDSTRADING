-- Agents VPS database. Two ledgers: agent_audit (what agents attempted) vs each system's /audit (what happened).
CREATE TABLE IF NOT EXISTS agent_audit (
  id              BIGSERIAL PRIMARY KEY,
  at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id          TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  phase           TEXT NOT NULL CHECK (phase IN ('intent','policy','execute','result','error')),
  tool            TEXT,
  input           JSONB,
  output          JSONB,
  policy_decision TEXT CHECK (policy_decision IN ('allow','deny','needs_approval')),
  policy_reason   TEXT,
  approval_id     BIGINT
);
CREATE INDEX IF NOT EXISTS agent_audit_at ON agent_audit (at DESC);
CREATE INDEX IF NOT EXISTS agent_audit_agent ON agent_audit (agent_id, at DESC);

CREATE TABLE IF NOT EXISTS approvals (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id        TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  tool          TEXT NOT NULL,
  input         JSONB NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  decided_by    TEXT,
  decided_at    TIMESTAMPTZ,
  decision_note TEXT
);

CREATE TABLE IF NOT EXISTS agent_runs (
  run_id      TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed','awaiting_approval')),
  task        TEXT NOT NULL,
  summary     TEXT,
  cost_usd    NUMERIC(10,4)
);

CREATE TABLE IF NOT EXISTS auditor_findings (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id      TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  category    TEXT NOT NULL,   -- scope_violation | ledger_mismatch | unusual_amount | policy_bypass | stale_data
  agent_id    TEXT,
  description TEXT NOT NULL,
  evidence    JSONB,
  resolved    BOOLEAN NOT NULL DEFAULT false
);
