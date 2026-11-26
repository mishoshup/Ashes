import {
  magicLinkInputSchema,
  magicLinkResponseSchema,
  verifyMagicLinkInputSchema,
  authSessionResponseSchema,
  passwordLoginInputSchema,
  setPasswordInputSchema,
} from "@ashes/contracts";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../middleware/auth";
import { sendMagicLink, verifyTurnstile } from "../services/email";
import { hashPassword, verifyPassword } from "../services/password";
import { checkRateLimit } from "../lib/rate-limit";
import {
  createLoginToken,
  finalizeLoginToken,
  findLoginRequest,
  findOrCreateUser,
  findPasswordHash,
  loginWithPassword,
  peekLoginToken,
  revokeSession,
  setPasswordAndRevokeOthers,
} from "../services/users";
import type { AppEnv } from "../types";

export const authRoutes = new Hono<AppEnv>();

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
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
  const now = new Date();
  const email = await peekLoginToken(c.env, parsed.data.token, now);
  if (!email) {
    badRequest("This sign-in link is invalid or expired");
  }
  const { user, isNewUser } = await findOrCreateUser(c.env, email, now);
  const token = await finalizeLoginToken(c.env, parsed.data.token, user.id, now);
  if (!token) {
    badRequest("This sign-in link is invalid or expired");
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
  const result = await loginWithPassword(c.env, email, parsed.data.password, new Date());
  if (!result) {
    throw new HTTPException(401, { message: "Email or password is incorrect" });
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
  const current = await findPasswordHash(c.env, user.id);
  if (current) {
    if (!parsed.data.currentPassword) {
      badRequest("Enter your current password");
    }
    const valid = await verifyPassword(
      parsed.data.currentPassword,
      current,
      c.env.PASSWORD_PEPPER ?? "",
    );
    if (!valid) {
      badRequest("Current password is incorrect");
    }
  }
  const now = new Date();
  await setPasswordAndRevokeOthers(
    c.env,
    user.id,
    await hashPassword(parsed.data.password, c.env.PASSWORD_PEPPER ?? ""),
    c.get("sessionToken"),
    now,
  );
  return c.body(null, 204);
});

authRoutes.post("/logout", requireAuth, async (c) => {
  await revokeSession(c.env, c.get("sessionToken"));
  return c.body(null, 204);
});

export const meRoutes = new Hono<AppEnv>();
meRoutes.get("/", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({ user, email: user.email });
});
