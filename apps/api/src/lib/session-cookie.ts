import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { AppEnv, Env } from "../types";
import { SESSION_MAX_AGE_SECONDS } from "./crypto";

export const SESSION_COOKIE = "ashes_session";

function cookieOptions(env: Env) {
  return {
    httpOnly: true,
    secure: env.ENVIRONMENT === "production",
    sameSite: "Lax" as const,
    path: "/",
  };
}

export function hasSessionCookie(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  return (c.req.header("Cookie") ?? "")
    .split(";")
    .some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
}

export function readSessionCookie(c: Context<AppEnv>): string | null {
  return getCookie(c, SESSION_COOKIE) ?? null;
}

export function setSessionCookie(c: Context<AppEnv>, token: string, env: Env): void {
  setCookie(c, SESSION_COOKIE, token, {
    ...cookieOptions(env),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context<AppEnv>, env: Env): void {
  deleteCookie(c, SESSION_COOKIE, cookieOptions(env));
}
