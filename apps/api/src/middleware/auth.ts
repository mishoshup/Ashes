import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types";
import { readSessionCookie } from "../lib/session-cookie";
import { findSession, touchSession } from "../services/sessions";

export function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const bearer = bearerToken(c.req.header("Authorization"));
  const token = bearer ?? readSessionCookie(c);
  if (!token) {
    throw new HTTPException(401, { message: "Sign in to continue" });
  }
  const now = new Date();
  const authenticated = await findSession(c.env, token, now);
  if (!authenticated) {
    throw new HTTPException(401, { message: "Session expired. Sign in again." });
  }
  c.set("user", authenticated.user);
  c.set("sessionToken", token);
  c.set("sessionId", authenticated.session.id ?? "");
  c.set("authKind", bearer ? "bearer" : "cookie");
  await touchSession(c.env, authenticated.session.token_hash, now);
  await next();
};
