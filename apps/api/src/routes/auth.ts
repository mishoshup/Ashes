import {
  magicLinkInputSchema,
  magicLinkResponseSchema,
  verifyMagicLinkInputSchema,
  authSessionResponseSchema,
} from "@ashes/contracts";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../middleware/auth";
import { sendMagicLink, verifyTurnstile } from "../services/email";
import {
  consumeLoginToken,
  createLoginToken,
  createSession,
  findOrCreateUser,
  revokeSession,
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
  const remoteIp = c.req.header("CF-Connecting-IP");
  const turnstileOk = await verifyTurnstile(c.env, parsed.data.turnstileToken, remoteIp);
  if (!turnstileOk) {
    badRequest("Complete the verification and try again");
  }

  const now = new Date();
  const token = await createLoginToken(c.env, email, now);
  const url = `${c.env.APP_ORIGIN}/auth/verify?token=${encodeURIComponent(token)}`;
  const sent = await sendMagicLink(c.env, email, url);

  if (!sent && c.env.ENVIRONMENT !== "development") {
    throw new HTTPException(503, { message: "Email is unavailable. Try again shortly." });
  }

  const response = magicLinkResponseSchema.parse({
    ok: true,
    ...(c.env.ENVIRONMENT === "development" ? { devToken: token } : {}),
  });
  return c.json(response);
});

authRoutes.post("/verify", async (c) => {
  const raw: unknown = await c.req.json().catch(() => null);
  const parsed = verifyMagicLinkInputSchema.safeParse(raw);
  if (!parsed.success) {
    badRequest("This sign-in link is invalid");
  }
  const now = new Date();
  const email = await consumeLoginToken(c.env, parsed.data.token, now);
  if (!email) {
    badRequest("This sign-in link is invalid or expired");
  }
  const { user, isNewUser } = await findOrCreateUser(c.env, email, now);
  const token = await createSession(c.env, user.id, now);
  return c.json(
    authSessionResponseSchema.parse({
      token,
      user,
      isNewUser,
    }),
  );
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
