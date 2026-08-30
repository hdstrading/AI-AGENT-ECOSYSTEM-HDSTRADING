export interface AuditStore {
  record(e: { actor: string; action: "create" | "update" | "delete"; resource: string; resource_id?: string; before?: unknown; after?: unknown; idempotency_key?: string }): Promise<void>;
}

type Req = { method: string; headers: Record<string, string | string[] | undefined>; body: unknown; agent?: { agent_id: string }; auditBefore?: unknown };
type Res = { json(body: unknown): void; statusCode?: number };
type Next = (err?: unknown) => void;

/**
 * Records every agent write into api_audit. Handler may set req.auditBefore for update/delete.
 * The agents VPS Auditor reads GET /audit and cross-checks against its own log — two ledgers, one truth.
 */
export function auditWrite(store: AuditStore, resource: string) {
  return (req: Req, res: Res, next: Next) => {
    const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update";
    const origJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const code = res.statusCode ?? 200;
      if (code < 300) {
        const after = body as { id?: string } | undefined;
        void store.record({
          actor: `agent:${req.agent?.agent_id ?? "unknown"}`,
          action, resource, resource_id: after?.id,
          before: req.auditBefore, after: body,
          idempotency_key: String(req.headers["idempotency-key"] ?? "") || undefined,
        });
      }
      origJson(body);
    };
    next();
  };
}
