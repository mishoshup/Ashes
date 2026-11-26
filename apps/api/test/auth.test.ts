import { authSessionResponseSchema, magicLinkResponseSchema } from "@ashes/contracts";
import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function post(path: string, body: unknown, token?: string) {
  return SELF.fetch(`https://example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function magicLink(email: string): Promise<string> {
  const response = await post("/api/auth/magic-link", { email });
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
    const response = await SELF.fetch("https://example.com/api/me");
    expect(response.status).toBe(401);
  });
});
