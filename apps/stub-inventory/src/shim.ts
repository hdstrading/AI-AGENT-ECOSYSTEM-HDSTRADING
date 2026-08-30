/**
 * Runs the Express-style middleware in api-spec/middleware/ inside Fastify.
 *
 * The middleware is deliberately duck-typed — it only needs `req.headers`, `req.body`,
 * `res.status().json()` — so no Express dependency is required. Proving that here is useful:
 * it is the same adaptation each real system will make when mounting these files.
 */
import type { FastifyReply, FastifyRequest } from "fastify";

export interface ShimReq {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  ip?: string;
  agent?: { agent_id: string; scopes: string[]; active: boolean };
  auditBefore?: unknown;
}

export class ShimRes {
  statusCode = 200;
  sent = false;
  /** Own property, not a prototype method: the middleware reassigns res.json to wrap it. */
  json: (body: unknown) => void;
  constructor(reply: FastifyReply) {
    this.json = (body: unknown) => {
      this.sent = true;
      void reply.code(this.statusCode).send(body);
    };
  }
  status(code: number): this { this.statusCode = code; return this; }
}

/** The middleware's own Req/Res types are file-local and unexported, hence the loose signature. */
export type Middleware = (req: any, res: any, next: (err?: unknown) => void) => unknown;

/** Run middleware in order. Resolves false as soon as one of them answers the request. */
export async function runChain(mws: Middleware[], req: ShimReq, res: ShimRes): Promise<boolean> {
  for (const mw of mws) {
    if (res.sent) return false;
    const proceed = await new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const next = (err?: unknown) => {
        if (settled) return;
        settled = true;
        err ? reject(err) : resolve(true);
      };
      Promise.resolve(mw(req, res, next)).then(
        () => { if (!settled) { settled = true; resolve(!res.sent); } },
        (e) => { if (!settled) { settled = true; reject(e); } },
      );
    });
    if (!proceed) return false;
  }
  return !res.sent;
}

export function withChain(
  mws: Middleware[],
  handler: (req: ShimReq, res: ShimRes, request: FastifyRequest) => Promise<void> | void,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const req: ShimReq = {
      method: request.method,
      headers: request.headers as Record<string, string | string[] | undefined>,
      body: request.body,
      ip: request.ip,
    };
    const res = new ShimRes(reply);
    try {
      if (await runChain(mws, req, res)) await handler(req, res, request);
    } catch (err) {
      if (!res.sent) res.status(500).json({ error: String(err), code: "internal" });
    }
    return reply;
  };
}
