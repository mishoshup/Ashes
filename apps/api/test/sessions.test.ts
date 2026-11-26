import {
  authSessionResponseSchema,
  magicLinkResponseSchema,
  sessionsResponseSchema,
  setPasswordResponseSchema,
  webAuthSessionResponseSchema,
} from "@ashes/contracts";
import { SELF } from "cloudflare:test";
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
    expect(body.items.filter((item) => item.current)).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("token");

    // And revokes the non-current session
    const other = body.items.find((item) => !item.current);
    if (!other) {
      throw new Error("missing non-current session");
    }
    const revoke = await SELF.fetch(`https://example.com/api/me/sessions/${other.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${first}` },
    });
    expect(revoke.status).toBe(204);

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
      body: JSON.stringify({ keepCurrent: true }),
    });
    expect(response.status).toBe(200);

    // Then the other is revoked and the current survives
    expect((await me(second)).status).toBe(401);
    expect((await me(first)).status).toBe(200);
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
      body: JSON.stringify({ keepCurrent: false }),
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

  it("rotates on password change and revokes the replacement on token reuse", async () => {
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

    // Then the old token is rejected and reuse revokes the replacement
    expect((await me(first)).status).toBe(401);
    expect((await me(body.token)).status).toBe(401);
  });
});
