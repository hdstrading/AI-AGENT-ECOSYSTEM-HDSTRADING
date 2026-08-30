/** Thin HTTP client for the four HDS systems. One instance per (system, agent key). */
export class HdsClient {
  constructor(private baseUrl: string, private apiKey: string, private agentId: string) {}
  private async req<T>(method: string, path: string, body?: unknown, idem?: string): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "X-Agent-Id": this.agentId };
    if (idem) headers["Idempotency-Key"] = idem;
    const r = await fetch(this.baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json: unknown; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(json)}`);
    return json as T;
  }
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    const qs = params ? "?" + Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
    return this.req<T>("GET", path + qs);
  }
  post<T>(path: string, body: unknown, idempotencyKey: string) { return this.req<T>("POST", path, body, idempotencyKey); }
}
