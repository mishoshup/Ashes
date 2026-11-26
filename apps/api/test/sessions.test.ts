import {
  authSessionResponseSchema,
  magicLinkResponseSchema,
  revokeAllSessionsResponseSchema,
  revokeSessionResponseSchema,
  sessionsResponseSchema,
  setPasswordResponseSchema,
  webAuthSessionResponseSchema,
} from "@ashes/contracts";
import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function post(path: string, body: unknown, token?: string, ip = `ip-${crypto.randomUUID()}`) {
  return SELF.fetch(`https://example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function magicLink(email: string): Promise<string> {
  const response = await post("/api/auth/magic-link", { email });
  expect(response.status).toBe(200);
  const body = magicLinkResponseSchema.parse(await response.json());
  if (!body.devToken) {
    throw new Error("missing dev token");
  }
  return body.devToken;
}

async function mobileSession(email: string): Promise<string> {
  const token = await magicLink(email);
  const response = await post("/api/auth/verify", { token, client: "mobile" });
  expect(response.status).toBe(200);
  return authSessionResponseSchema.parse(await response.json()).token;
}

async function webCookie(email: string): Promise<string> {
  const token = await magicLink(email);
  const response = await post("/api/auth/verify", { token, client: "web" });
  expect(response.status).toBe(200);
  webAuthSessionResponseSchema.parse(await response.json());
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  if (!cookie?.startsWith("ashes_session=")) {
    throw new Error(`missing session cookie: ${setCookie}`);
  }
  return cookie;
}

async function me(token?: string, cookie?: string) {
  return SELF.fetch("https://example.com/api/me", {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}

describe("sessions", () => {
  it("sets an HttpOnly web cookie and blocks cookie writes without an allowed origin", async () => {
    // Given a verified web session
    const token = await magicLink("cookie@example.com");
    const response = await post("/api/auth/verify", { token, client: "web" });
    expect(response.status).toBe(200);

    // Then the cookie is HttpOnly, SameSite=Lax, and the body has no token
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ashes_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    const body = webAuthSessionResponseSchema.parse(await response.json());
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("token");

    // And the cookie authenticates reads with credentialed CORS
    const cookie = setCookie.split(";")[0] ?? "";
    const read = await SELF.fetch("https://example.com/api/me", {
      headers: { Cookie: cookie, Origin: "http://localhost:8081" },
    });
    expect(read.status).toBe(200);
    expect(read.headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
    expect(read.headers.get("access-control-allow-credentials")).toBe("true");

    const preflight = await SELF.fetch("https://example.com/api/me", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:8081" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");

    // But a cookie write without Origin is rejected
    const blocked = await SELF.fetch("https://example.com/api/me/sessions/revoke-all", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: "{}",
    });
    expect(blocked.status).toBe(403);

    // And the same write with the web origin succeeds
    const allowed = await SELF.fetch("https://example.com/api/me/sessions/revoke-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "http://localhost:8081",
      },
      body: "{}",
    });
    expect(allowed.status).toBe(200);
  });

  it("clears the web cookie on logout", async () => {
    // Given a web session
    const cookie = await webCookie("logout-cookie@example.com");
    expect((await me(undefined, cookie)).status).toBe(200);

    // When the user logs out from the web
    const response = await SELF.fetch("https://example.com/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "http://localhost:8081",
      },
      body: "{}",
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("ashes_session=");

    // Then the old cookie is no longer authenticated
    expect((await me(undefined, cookie)).status).toBe(401);
  });

  it("lists sessions, revokes one, and leaves the other active", async () => {
    // Given two mobile sessions
    const first = await mobileSession("two-devices@example.com");
    const second = await mobileSession("two-devices@example.com");

    // When the first lists its sessions
    const list = await SELF.fetch("https://example.com/api/me/sessions", {
      headers: { Authorization: `Bearer ${first}` },
    });
    const body = sessionsResponseSchema.parse(await list.json());
    expect(body.items).toHaveLength(2);
    expect(body.items.filter((item) => item.isCurrent)).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("token");

    // And revokes the non-current session
    const other = body.items.find((item) => !item.isCurrent);
    if (!other) {
      throw new Error("missing non-current session");
    }
    const revoke = await SELF.fetch(`https://example.com/api/me/sessions/${other.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${first}` },
    });
    expect(revoke.status).toBe(200);
    expect(revokeSessionResponseSchema.parse(await revoke.json()).ok).toBe(true);

    // Then the revoked session is rejected and the current one still works
    expect((await me(second)).status).toBe(401);
    expect((await me(first)).status).toBe(200);
  });

  it("revokes all other sessions", async () => {
    // Given two sessions
    const first = await mobileSession("revoke-all@example.com");
    const second = await mobileSession("revoke-all@example.com");

    // When revoke-all keeps the current session
    const response = await SELF.fetch("https://example.com/api/me/sessions/revoke-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${first}`,
      },
      body: JSON.stringify({ shouldKeepCurrent: true }),
    });
    expect(response.status).toBe(200);

    // Then the other is revoked and the current survives
    expect((await me(second)).status).toBe(401);
    expect((await me(first)).status).toBe(200);
  });

  it("replays session revocations with the same idempotency key", async () => {
    // Given two sessions and one key
    const first = await mobileSession("idempotent-revoke@example.com");
    const second = await mobileSession("idempotent-revoke@example.com");
    const key = crypto.randomUUID();
    const revokeAll = () =>
      SELF.fetch("https://example.com/api/me/sessions/revoke-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${first}`,
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ shouldKeepCurrent: true }),
      });

    // When revoke-all is retried with the same key
    const firstCall = await revokeAll();
    const secondCall = await revokeAll();

    // Then the count is replayed and the other session is still revoked
    expect(firstCall.status).toBe(200);
    expect(secondCall.status).toBe(200);
    const firstBody = revokeAllSessionsResponseSchema.parse(await firstCall.json());
    const secondBody = revokeAllSessionsResponseSchema.parse(await secondCall.json());
    expect(firstBody.revoked).toBe(1);
    expect(secondBody.revoked).toBe(1);
    expect((await me(second)).status).toBe(401);
  });

  it("revokes all sessions including the current one", async () => {
    // Given two sessions
    const first = await mobileSession("revoke-everything@example.com");
    const second = await mobileSession("revoke-everything@example.com");

    // When revoke-all includes the current session
    const response = await SELF.fetch("https://example.com/api/me/sessions/revoke-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${first}`,
      },
      body: JSON.stringify({ shouldKeepCurrent: false }),
    });
    expect(response.status).toBe(200);

    // Then both are invalid
    expect((await me(first)).status).toBe(401);
    expect((await me(second)).status).toBe(401);
  });

  it("does not revoke another user's session by id", async () => {
    // Given two users with one session each
    const first = await mobileSession("owner-scope-a@example.com");
    const second = await mobileSession("owner-scope-b@example.com");
    const list = await SELF.fetch("https://example.com/api/me/sessions", {
      headers: { Authorization: `Bearer ${first}` },
    });
    const body = sessionsResponseSchema.parse(await list.json());
    const target = body.items[0];
    if (!target) {
      throw new Error("missing session");
    }

    // When the second user tries to revoke it
    const response = await SELF.fetch(`https://example.com/api/me/sessions/${target.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${second}` },
    });

    // Then it is not found and the owner remains signed in
    expect(response.status).toBe(404);
    expect((await me(first)).status).toBe(200);
  });

  it("rejects an oversized session body", async () => {
    // Given a mobile session
    const token = await mobileSession("body-cap@example.com");

    // When revoke-all receives a body over the cap
    const response = await SELF.fetch("https://example.com/api/me/sessions/revoke-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ padding: "x".repeat(300 * 1024) }),
    });

    // Then it is rejected before parsing
    expect(response.status).toBe(413);
  });

  it("rate limits revoke-all", async () => {
    // Given a mobile session
    const token = await mobileSession("rate-limit-sessions@example.com");
    const request = () =>
      SELF.fetch("https://example.com/api/me/sessions/revoke-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shouldKeepCurrent: true }),
      });

    // When the endpoint is called past its allowance
    for (let index = 0; index < 10; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- each call must consume one rate-limit slot
      expect((await request()).status).toBe(200);
    }
    const blocked = await request();

    // Then the next call is throttled
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
  });

  it("rotates on password change, allows in-flight requests, then detects reuse", async () => {
    // Given a mobile session
    const first = await mobileSession("rotation@example.com");

    // When a password is set
    const set = await post(
      "/api/auth/password",
      { password: "correct horse battery staple" },
      first,
    );
    expect(set.status).toBe(200);
    const body = setPasswordResponseSchema.parse(await set.json());
    if (!body.token) {
      throw new Error("expected a rotated token");
    }

    // Then an in-flight old-token request is rejected but does not kill the replacement
    expect((await me(first)).status).toBe(401);
    expect((await me(body.token)).status).toBe(200);

    // When the rotation is older than the reuse grace window
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind("rotation@example.com")
      .first<{ id: string }>();
    if (!user) {
      throw new Error("missing rotation user");
    }
    await env.DB.prepare(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_reason = 'rotated'",
    )
      .bind("2020-01-01T00:00:00.000Z", user.id)
      .run();

    // Then presenting the old token revokes the replacement chain
    expect((await me(first)).status).toBe(401);
    expect((await me(body.token)).status).toBe(401);
  });
});
