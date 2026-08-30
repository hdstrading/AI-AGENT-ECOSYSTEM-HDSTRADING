import { createHash } from "node:crypto";

export interface IdemStore {
  get(key: string): Promise<{ agent_id: string; request_hash: string; response_code: number | null; response_body: unknown } | null>;
  put(key: string, agent_id: string, request_hash: string): Promise<void>;
  complete(key: string, code: number, body: unknown): Promise<void>;
}

type Req = { headers: Record<string, string | string[] | undefined>; body: unknown; agent?: { agent_id: string } };
type Res = { status(code: number): Res; json(body: unknown): void; statusCode?: number };
type Next = (err?: unknown) => void;

/** Same key + same payload -> replay stored response. Same key + different payload -> 409. */
export function idempotency(store: IdemStore) {
  return async (req: Req, res: Res, next: Next) => {
    const key = String(req.headers["idempotency-key"] ?? "");
    if (key.length < 16) return res.status(400).json({ error: "Idempotency-Key header required (>=16 chars)", code: "validation" });
    const reqHash = createHash("sha256").update(JSON.stringify(req.body ?? {})).digest("hex");
    const existing = await store.get(key);
    if (existing) {
      if (existing.request_hash !== reqHash)
        return res.status(409).json({ error: "Idempotency-Key reused with different payload", code: "conflict" });
      if (existing.response_code != null) return res.status(existing.response_code).json(existing.response_body);
      return res.status(409).json({ error: "Request in flight", code: "conflict" });
    }
    await store.put(key, req.agent?.agent_id ?? "unknown", reqHash);
    const origJson = res.json.bind(res);
    res.json = (body: unknown) => { void store.complete(key, res.statusCode ?? 200, body); origJson(body); };
    next();
  };
}
