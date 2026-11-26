import {
  idSchema,
  meResponseSchema,
  revokeAllSessionsInputSchema,
  revokeAllSessionsResponseSchema,
  revokeSessionResponseSchema,
  sessionsResponseSchema,
} from "@ashes/contracts";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { checkRateLimit } from "../lib/rate-limit";
import { clearSessionCookie } from "../lib/session-cookie";
import { requireAuth } from "../middleware/auth";
import { hashRequestForKey, withIdempotency } from "../services/idempotency";
import { listSessions, revokeAllSessions, revokeSessionById } from "../services/sessions";
import type { AppEnv } from "../types";

export const meRoutes = new Hono<AppEnv>();

function noStore(c: { header: (name: string, value: string) => void }): void {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
}

meRoutes.get("/", requireAuth, (c) => {
  noStore(c);
  const user = c.get("user");
  return c.json(meResponseSchema.parse({ user, email: user.email }));
});

meRoutes.get("/sessions", requireAuth, async (c) => {
  noStore(c);
  const user = c.get("user");
  if (!(await checkRateLimit(c.env, `sessions:list:${user.id}`, 60, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  const items = await listSessions(c.env, user.id, c.get("sessionToken"), new Date());
  return c.json(sessionsResponseSchema.parse({ items }));
});

meRoutes.post("/sessions/revoke-all", requireAuth, async (c) => {
  const user = c.get("user");
  if (!(await checkRateLimit(c.env, `sessions:revoke-all:${user.id}`, 10, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  const raw: unknown = await c.req.json().catch(() => ({}));
  const parsed = revokeAllSessionsInputSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new HTTPException(400, { message: "Invalid revoke request" });
  }
  const now = new Date();
  const idempotencyKey = c.req.header("Idempotency-Key");
  const response = await withIdempotency(
    c.env,
    user.id,
    idempotencyKey,
    await hashRequestForKey(c.env, idempotencyKey, parsed.data),
    revokeAllSessionsResponseSchema,
    now,
    async () => {
      const revoked = await revokeAllSessions(
        c.env,
        user.id,
        c.get("sessionToken"),
        parsed.data.shouldKeepCurrent,
        now,
      );
      if (!parsed.data.shouldKeepCurrent) {
        clearSessionCookie(c, c.env);
      }
      return { revoked };
    },
    undefined,
    (stored) => {
      if (!parsed.data.shouldKeepCurrent) {
        clearSessionCookie(c, c.env);
      }
      return stored;
    },
  );
  noStore(c);
  return c.json(response);
});

meRoutes.delete("/sessions/:id", requireAuth, async (c) => {
  const user = c.get("user");
  if (!(await checkRateLimit(c.env, `sessions:revoke-one:${user.id}`, 30, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  const parsed = idSchema.safeParse(c.req.param("id"));
  if (!parsed.success) {
    throw new HTTPException(404, { message: "Session not found" });
  }
  const now = new Date();
  const idempotencyKey = c.req.header("Idempotency-Key");
  const response = await withIdempotency(
    c.env,
    user.id,
    idempotencyKey,
    await hashRequestForKey(c.env, idempotencyKey, { sessionId: parsed.data }),
    revokeSessionResponseSchema,
    now,
    async () => {
      const revoked = await revokeSessionById(c.env, user.id, parsed.data, now);
      if (!revoked) {
        throw new HTTPException(404, { message: "Session not found" });
      }
      if (c.get("sessionId") === parsed.data) {
        clearSessionCookie(c, c.env);
      }
      return { ok: true as const };
    },
    undefined,
    (stored) => {
      if (c.get("sessionId") === parsed.data) {
        clearSessionCookie(c, c.env);
      }
      return stored;
    },
  );
  noStore(c);
  return c.json(response);
});
