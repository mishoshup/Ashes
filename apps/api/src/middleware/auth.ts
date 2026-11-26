import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types";
import { findSessionUser } from "../services/users";

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
  const token = bearerToken(c.req.header("Authorization"));
  if (!token) {
    throw new HTTPException(401, { message: "Sign in to continue" });
  }
  const user = await findSessionUser(c.env, token, new Date());
  if (!user) {
    throw new HTTPException(401, { message: "Session expired. Sign in again." });
  }
  c.set("user", user);
  c.set("sessionToken", token);
  await next();
};
