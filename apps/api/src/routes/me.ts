import {
  idSchema,
  meResponseSchema,
  revokeAllSessionsInputSchema,
  revokeAllSessionsResponseSchema,
  sessionsResponseSchema,
} from "@ashes/contracts";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { checkRateLimit } from "../lib/rate-limit";
import { clearSessionCookie } from "../lib/session-cookie";
import { requireAuth } from "../middleware/auth";
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
  const revoked = await revokeAllSessions(
    c.env,
    user.id,
    c.get("sessionToken"),
    parsed.data.shouldKeepCurrent,
    new Date(),
  );
  if (!parsed.data.shouldKeepCurrent) {
    clearSessionCookie(c, c.env);
  }
  noStore(c);
  return c.json(revokeAllSessionsResponseSchema.parse({ revoked }));
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
  const revoked = await revokeSessionById(c.env, user.id, parsed.data, new Date());
  if (!revoked) {
    throw new HTTPException(404, { message: "Session not found" });
  }
  if (c.get("sessionId") === parsed.data) {
    clearSessionCookie(c, c.env);
  }
  noStore(c);
  return c.body(null, 204);
});
