import {
  authSessionResponseSchema,
  magicLinkResponseSchema,
  setPasswordResponseSchema,
} from "@ashes/contracts";
import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function post(
  path: string,
  body: unknown,
  token?: string,
  ip = "local",
  idempotencyKey?: string,
) {
  return SELF.fetch(`https://example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function magicLink(email: string, ip = `test-${crypto.randomUUID()}`): Promise<string> {
  const response = await post("/api/auth/magic-link", { email }, undefined, ip);
  expect(response.status).toBe(200);
  const body = magicLinkResponseSchema.parse(await response.json());
  expect(typeof body.devToken).toBe("string");
  return body.devToken ?? "";
}

describe("magic link auth", () => {
  it("signs in, returns the user, and revokes the session", async () => {
    // Given a new email
    const token = await magicLink("alex@example.com");

    // When the magic link is verified
    const verify = await post("/api/auth/verify", { token });
    expect(verify.status).toBe(200);
    const session = authSessionResponseSchema.parse(await verify.json());
    expect(session.isNewUser).toBe(true);
    expect(session.user.handle).toMatch(/^[a-z0-9_]+$/u);
    expect(session.token.length).toBeGreaterThan(20);

    // Then /api/me returns the same user
    const me = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(me.status).toBe(200);

    // And the same link cannot be reused
    const replay = await post("/api/auth/verify", { token });
    expect(replay.status).toBe(400);

    // And logout invalidates the session
    const logout = await post("/api/auth/logout", {}, session.token);
    expect(logout.status).toBe(204);
    const after = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(after.status).toBe(401);
  });

  it("returns the same user on a second sign-in", async () => {
    // Given an existing account
    const first = await magicLink("same@example.com");
    const firstVerify = await post("/api/auth/verify", { token: first });
    const firstSession = authSessionResponseSchema.parse(await firstVerify.json());

    // When the same email signs in again
    const second = await magicLink("same@example.com");
    const secondVerify = await post("/api/auth/verify", { token: second });
    const secondSession = authSessionResponseSchema.parse(await secondVerify.json());

    // Then it is the same user
    expect(secondSession.isNewUser).toBe(false);
    expect(secondSession.user.id).toBe(firstSession.user.id);
  });

  it("rejects an expired link", async () => {
    // Given a token that has expired
    const token = await magicLink("expired@example.com");
    const tokenHash = await (async () => {
      const data = new TextEncoder().encode(`${env.SESSION_PEPPER ?? ""}:${token}`);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    })();
    await env.DB.prepare("UPDATE login_tokens SET expires_at = ? WHERE token_hash = ?")
      .bind("2020-01-01T00:00:00.000Z", tokenHash)
      .run();

    // When it is verified
    const response = await post("/api/auth/verify", { token });

    // Then it is rejected
    expect(response.status).toBe(400);
  });

  it("rejects an unauthenticated me request", async () => {
    // Given a request with no bearer token
    // When /api/me is fetched
    const response = await SELF.fetch("https://example.com/api/me");

    // Then the API rejects it
    expect(response.status).toBe(401);
  });

  it("replays an idempotent magic-link request without a second token", async () => {
    // Given a magic-link request with an idempotency key
    const key = "idem-12345678";
    const email = "idem@example.com";
    const first = await post("/api/auth/magic-link", { email }, undefined, "idem-ip", key);
    const firstBody = magicLinkResponseSchema.parse(await first.json());

    // When the same request is retried
    const second = await post("/api/auth/magic-link", { email }, undefined, "idem-ip", key);
    const secondBody = magicLinkResponseSchema.parse(await second.json());

    // Then it succeeds without issuing another dev token
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(typeof firstBody.devToken).toBe("string");
    expect(secondBody.devToken).toBeUndefined();
  });

  it("replays an idempotency key after the token expires", async () => {
    // Given a magic link that has expired
    const key = "idem-expired-1234";
    const email = "expired-idem@example.com";
    const first = await post("/api/auth/magic-link", { email }, undefined, "idem-expired-ip", key);
    expect(first.status).toBe(200);
    await env.DB.prepare(
      "UPDATE login_tokens SET expires_at = ? WHERE email = ? AND request_key = ?",
    )
      .bind("2020-01-01T00:00:00.000Z", email, key)
      .run();

    // When the same idempotent request is retried
    const second = await post("/api/auth/magic-link", { email }, undefined, "idem-expired-ip", key);
    const body = magicLinkResponseSchema.parse(await second.json());

    // Then it is treated as the same request, not a new token or a constraint error
    expect(second.status).toBe(200);
    expect(body.devToken).toBeUndefined();
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM login_tokens WHERE email = ? AND request_key = ?",
    )
      .bind(email, key)
      .first<{ count: number }>();
    expect(row?.count).toBe(1);
  });

  it("sets a password from a magic-link session and logs in with it", async () => {
    // Given a verified magic-link session
    const email = "password@example.com";
    const magic = await magicLink(email);
    const verified = await post("/api/auth/verify", { token: magic }, undefined, "pw-ip");
    const session = authSessionResponseSchema.parse(await verified.json());
    const password = "correct horse battery staple";

    // When the user sets a password
    const set = await post("/api/auth/password", { password }, session.token, "pw-ip");
    expect(set.status).toBe(200);
    const setBody = setPasswordResponseSchema.parse(await set.json());
    if (!setBody.token) {
      throw new Error("expected a rotated session token");
    }
    const rotated = setBody.token;

    // Then the rotated token works, logout revokes it, and the old token is rejected
    const rotatedMe = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${rotated}` },
    });
    expect(rotatedMe.status).toBe(200);
    const logout = await post("/api/auth/logout", {}, rotated, "pw-ip");
    expect(logout.status).toBe(204);
    const oldMe = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(oldMe.status).toBe(401);

    // Then password login returns a session and /api/me works
    const login = await post("/api/auth/login", { email, password }, undefined, "pw-login-ip");
    expect(login.status).toBe(200);
    const loginSession = authSessionResponseSchema.parse(await login.json());
    expect(loginSession.isNewUser).toBe(false);
    const me = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${loginSession.token}` },
    });
    expect(me.status).toBe(200);
    expect(me.headers.get("content-type")).toContain("application/json");
    expect(await me.text()).not.toContain("argon2id");

    // And the stored hash is Argon2id with the expected cost
    const row = await env.DB.prepare("SELECT password_hash FROM users WHERE email = ?")
      .bind(email)
      .first<{ password_hash: string | null }>();
    expect(row?.password_hash).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/u,
    );
  });

  it("rejects wrong, missing, and no-password logins", async () => {
    // Given an account with a password
    const email = "wrong-password@example.com";
    const magic = await magicLink(email);
    const verified = await post("/api/auth/verify", { token: magic }, undefined, "wrong-ip");
    const session = authSessionResponseSchema.parse(await verified.json());
    const password = "another long password";
    await post("/api/auth/password", { password }, session.token, "wrong-ip");

    // When login is attempted with bad credentials, an unknown email, or no password
    const wrong = await post(
      "/api/auth/login",
      { email, password: "not the password" },
      undefined,
      "wrong-login-ip",
    );
    const unknown = await post(
      "/api/auth/login",
      { email: "nobody@example.com", password: "not the password" },
      undefined,
      "unknown-ip",
    );
    const noPasswordMagic = await magicLink("no-password@example.com");
    const noPassword = await post(
      "/api/auth/login",
      { email: "no-password@example.com", password: "some long password" },
      undefined,
      "no-password-ip",
    );
    expect(noPasswordMagic.length).toBeGreaterThan(20);

    // Then all are generic 401s
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(noPassword.status).toBe(401);
  });

  it("requires the current password to change an existing password", async () => {
    // Given an account with a password
    const email = "change-password@example.com";
    const magic = await magicLink(email);
    const verified = await post("/api/auth/verify", { token: magic }, undefined, "change-ip");
    const session = authSessionResponseSchema.parse(await verified.json());
    const oldPassword = "old password is long";
    const newPassword = "new password is longer";
    const firstSet = await post(
      "/api/auth/password",
      { password: oldPassword },
      session.token,
      "change-ip",
    );
    const firstBody = setPasswordResponseSchema.parse(await firstSet.json());
    if (!firstBody.token) {
      throw new Error("expected a rotated session token");
    }
    const activeToken = firstBody.token;

    // When changing without / with the wrong current password
    const missing = await post(
      "/api/auth/password",
      { password: newPassword },
      activeToken,
      "change-ip",
    );
    const wrong = await post(
      "/api/auth/password",
      { password: newPassword, currentPassword: "not the old one" },
      activeToken,
      "change-ip",
    );
    // Then both are rejected
    expect(missing.status).toBe(400);
    expect(wrong.status).toBe(400);

    // Given a second active session for the same account
    const secondMagic = await magicLink(email);
    const secondVerified = await post(
      "/api/auth/verify",
      { token: secondMagic },
      undefined,
      "change-second-ip",
    );
    const secondSession = authSessionResponseSchema.parse(await secondVerified.json());

    // When changing with the correct current password
    const changed = await post(
      "/api/auth/password",
      { password: newPassword, currentPassword: oldPassword },
      activeToken,
      "change-ip",
    );

    // Then the current session rotates and the other session is revoked
    expect(changed.status).toBe(200);
    const changedBody = setPasswordResponseSchema.parse(await changed.json());
    if (!changedBody.token) {
      throw new Error("expected a rotated session token");
    }
    const currentMe = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${changedBody.token}` },
    });
    const oldCurrentMe = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const secondMe = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${secondSession.token}` },
    });
    expect(currentMe.status).toBe(200);
    expect(oldCurrentMe.status).toBe(401);
    expect(secondMe.status).toBe(401);
    const oldLogin = await post(
      "/api/auth/login",
      { email, password: oldPassword },
      undefined,
      "change-login-ip",
    );
    const newLogin = await post(
      "/api/auth/login",
      { email, password: newPassword },
      undefined,
      "change-login-ip",
    );
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it("rejects a password shorter than the policy", async () => {
    // Given a magic-link session
    const magic = await magicLink("short-password@example.com");
    const verified = await post("/api/auth/verify", { token: magic }, undefined, "short-ip");
    const session = authSessionResponseSchema.parse(await verified.json());

    // When a short password is set
    const response = await post(
      "/api/auth/password",
      { password: "short" },
      session.token,
      "short-ip",
    );

    // Then it is rejected
    expect(response.status).toBe(400);
  });

  it("fails closed when the password pepper is missing or short", async () => {
    // Given a verified session and a missing/short pepper
    const magic = await magicLink("pepper@example.com");
    const verified = await post("/api/auth/verify", { token: magic }, undefined, "pepper-ip");
    const session = authSessionResponseSchema.parse(await verified.json());
    const original = env.PASSWORD_PEPPER;

    try {
      env.PASSWORD_PEPPER = "";
      // When login and password set are called
      const login = await post(
        "/api/auth/login",
        { email: "pepper@example.com", password: "some long password" },
        undefined,
        "pepper-login-ip",
      );
      const set = await post(
        "/api/auth/password",
        { password: "some long password" },
        session.token,
        "pepper-ip",
      );

      // Then both fail closed
      expect(login.status).toBe(503);
      expect(set.status).toBe(503);

      env.PASSWORD_PEPPER = "short";
      const short = await post(
        "/api/auth/login",
        { email: "pepper@example.com", password: "some long password" },
        undefined,
        "pepper-short-ip",
      );
      expect(short.status).toBe(503);
    } finally {
      env.PASSWORD_PEPPER = original;
    }
  });

  it("rate limits magic links per IP", async () => {
    // Given ten magic-link requests from one IP
    const allowed = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        post(
          "/api/auth/magic-link",
          { email: `rate-${index}@example.com` },
          undefined,
          "203.0.113.10",
        ),
      ),
    );
    for (const response of allowed) {
      expect(response.status).toBe(200);
    }

    // When an eleventh request arrives
    const blocked = await post(
      "/api/auth/magic-link",
      { email: "rate-blocked@example.com" },
      undefined,
      "203.0.113.10",
    );

    // Then it is rejected with a retry hint
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
  });
});
