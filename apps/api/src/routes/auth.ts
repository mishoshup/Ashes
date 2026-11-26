import {
  authSessionResponseSchema,
  magicLinkInputSchema,
  magicLinkResponseSchema,
  passwordLoginInputSchema,
  setPasswordInputSchema,
  setPasswordResponseSchema,
  verifyMagicLinkInputSchema,
  webAuthSessionResponseSchema,
} from "@ashes/contracts";
import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { bearerToken, requireAuth } from "../middleware/auth";
import { sendMagicLink, verifyTurnstile } from "../services/email";
import { hashPassword, verifyPassword } from "../services/password";
import { checkRateLimit } from "../lib/rate-limit";
import { hashRequestForKey, withIdempotency } from "../services/idempotency";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "../lib/session-cookie";
import { revokeSession, rotateSession, sessionMetaFromRequest } from "../services/sessions";
import {
  createLoginToken,
  createSession,
  finalizeLoginToken,
  findLoginRequest,
  findOrCreateUser,
  findPasswordHash,
  loginWithPassword,
  peekLoginToken,
  setPasswordAndRevokeOthers,
} from "../services/users";
import type { AppEnv, Env } from "../types";

export const authRoutes = new Hono<AppEnv>();

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

function noStore(c: { header: (name: string, value: string) => void }): void {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
}

function requireWebOrigin(c: Context<AppEnv>): void {
  const origin = c.req.header("Origin");
  const allowed: string[] = [c.env.WEB_ORIGIN, c.env.APP_ORIGIN].filter(Boolean);
  if (!origin || !allowed.includes(origin)) {
    throw new HTTPException(403, { message: "Cross-origin request blocked" });
  }
}

function requirePasswordPepper(env: Env): string {
  if (!env.PASSWORD_PEPPER || env.PASSWORD_PEPPER.length < 32) {
    throw new HTTPException(503, { message: "Password login is unavailable" });
  }
  return env.PASSWORD_PEPPER;
}

authRoutes.post("/magic-link", async (c) => {
  const raw: unknown = await c.req.json().catch(() => null);
  const parsed = magicLinkInputSchema.safeParse(raw);
  if (!parsed.success) {
    badRequest("Enter a valid email address");
  }
  const email = parsed.data.email.trim().toLowerCase();
  const remoteIp = c.req.header("CF-Connecting-IP") ?? "local";
  if (!(await checkRateLimit(c.env, `magic:ip:${remoteIp}`, 10, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  if (!(await checkRateLimit(c.env, `magic:email:${email}`, 5, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }

  const turnstileOk = await verifyTurnstile(c.env, parsed.data.turnstileToken, remoteIp);
  if (!turnstileOk) {
    badRequest("Complete the verification and try again");
  }

  const requestKey = c.req.header("Idempotency-Key");
  if (requestKey && (requestKey.length < 8 || requestKey.length > 128)) {
    badRequest("Invalid idempotency key");
  }
  const now = new Date();
  if (requestKey && (await findLoginRequest(c.env, email, requestKey))) {
    return c.json({ ok: true });
  }

  const token = await createLoginToken(c.env, email, now, requestKey);
  const url = `${c.env.APP_ORIGIN}/auth/verify?token=${encodeURIComponent(token)}`;
  const sent = await sendMagicLink(c.env, email, url);
  const devToken = c.env.ALLOW_DEV_AUTH_TOKEN === "true" ? token : undefined;

  if (!sent && !devToken) {
    throw new HTTPException(503, { message: "Email is unavailable. Try again shortly." });
  }

  const response = magicLinkResponseSchema.parse({
    ok: true,
    ...(devToken ? { devToken } : {}),
  });
  noStore(c);
  return c.json(response);
});

authRoutes.post("/verify", async (c) => {
  const raw: unknown = await c.req.json().catch(() => null);
  const parsed = verifyMagicLinkInputSchema.safeParse(raw);
  if (!parsed.success) {
    badRequest("This sign-in link is invalid");
  }
  const remoteIp = c.req.header("CF-Connecting-IP") ?? "local";
  if (!(await checkRateLimit(c.env, `verify:ip:${remoteIp}`, 20, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  if (parsed.data.client === "web") {
    requireWebOrigin(c);
  }
  const now = new Date();
  const email = await peekLoginToken(c.env, parsed.data.token, now);
  if (!email) {
    badRequest("This sign-in link is invalid or expired");
  }
  const { user, isNewUser } = await findOrCreateUser(c.env, email, now);
  const token = await finalizeLoginToken(
    c.env,
    parsed.data.token,
    user.id,
    now,
    await sessionMetaFromRequest(c),
  );
  if (!token) {
    badRequest("This sign-in link is invalid or expired");
  }
  noStore(c);
  if (parsed.data.client === "web") {
    setSessionCookie(c, token, c.env);
    return c.json(webAuthSessionResponseSchema.parse({ ok: true, user, isNewUser }));
  }
  return c.json(
    authSessionResponseSchema.parse({
      token,
      user,
      isNewUser,
    }),
  );
});

authRoutes.post("/login", async (c) => {
  const raw: unknown = await c.req.json().catch(() => null);
  const parsed = passwordLoginInputSchema.safeParse(raw);
  if (!parsed.success) {
    badRequest("Email or password is incorrect");
  }
  const email = parsed.data.email.trim().toLowerCase();
  const remoteIp = c.req.header("CF-Connecting-IP") ?? "local";
  if (!(await checkRateLimit(c.env, `login:ip:${remoteIp}`, 10, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  if (!(await checkRateLimit(c.env, `login:email:${email}`, 5, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  if (parsed.data.client === "web") {
    requireWebOrigin(c);
  }
  const pepper = requirePasswordPepper(c.env);
  const result = await loginWithPassword(
    c.env,
    email,
    parsed.data.password,
    new Date(),
    pepper,
    await sessionMetaFromRequest(c),
  );
  if (!result) {
    throw new HTTPException(401, { message: "Email or password is incorrect" });
  }
  noStore(c);
  if (parsed.data.client === "web") {
    setSessionCookie(c, result.token, c.env);
    return c.json(
      webAuthSessionResponseSchema.parse({
        ok: true,
        user: result.user,
        isNewUser: false,
      }),
    );
  }
  return c.json(
    authSessionResponseSchema.parse({
      token: result.token,
      user: result.user,
      isNewUser: false,
    }),
  );
});

authRoutes.post("/password", requireAuth, async (c) => {
  const user = c.get("user");
  const raw: unknown = await c.req.json().catch(() => null);
  const parsed = setPasswordInputSchema.safeParse(raw);
  if (!parsed.success) {
    badRequest("Use at least 12 characters");
  }
  if (!(await checkRateLimit(c.env, `password:user:${user.id}`, 5, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  const pepper = requirePasswordPepper(c.env);
  const now = new Date();
  const idempotencyKey = c.req.header("Idempotency-Key");
  const response = await withIdempotency(
    c.env,
    user.id,
    idempotencyKey,
    await hashRequestForKey(c.env, idempotencyKey, parsed.data),
    setPasswordResponseSchema,
    now,
    async () => {
      const current = await findPasswordHash(c.env, user.id);
      if (current) {
        if (!parsed.data.currentPassword) {
          badRequest("Enter your current password");
        }
        const valid = await verifyPassword(parsed.data.currentPassword, current, pepper);
        if (!valid) {
          badRequest("Current password is incorrect");
        }
      }
      await setPasswordAndRevokeOthers(
        c.env,
        user.id,
        await hashPassword(parsed.data.password, pepper),
        c.get("sessionToken"),
        now,
      );
      const token = await rotateSession(
        c.env,
        user.id,
        c.get("sessionToken"),
        now,
        await sessionMetaFromRequest(c),
      );
      if (!token) {
        throw new HTTPException(401, { message: "Session expired. Sign in again." });
      }
      if (c.get("authKind") === "cookie") {
        setSessionCookie(c, token, c.env);
        return setPasswordResponseSchema.parse({ ok: true });
      }
      return setPasswordResponseSchema.parse({ ok: true, token });
    },
    () => ({ ok: true }),
    async () => {
      const token = await createSession(c.env, user.id, now, await sessionMetaFromRequest(c));
      if (c.get("authKind") === "cookie") {
        setSessionCookie(c, token, c.env);
        return setPasswordResponseSchema.parse({ ok: true });
      }
      return setPasswordResponseSchema.parse({ ok: true, token });
    },
  );
  noStore(c);
  return c.json(response);
});

authRoutes.post("/logout", async (c) => {
  const remoteIp = c.req.header("CF-Connecting-IP") ?? "local";
  if (!(await checkRateLimit(c.env, `logout:ip:${remoteIp}`, 30, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Too many attempts. Wait a minute." });
  }
  const token = bearerToken(c.req.header("Authorization")) ?? readSessionCookie(c);
  if (token) {
    await revokeSession(c.env, token, "logout", new Date());
  }
  clearSessionCookie(c, c.env);
  noStore(c);
  return c.body(null, 204);
});
