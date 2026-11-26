import {
  authSessionResponseSchema,
  checkInResponseSchema,
  magicLinkResponseSchema,
} from "@ashes/contracts";
import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { withIdempotency } from "../src/services/idempotency";

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

async function newSession(email: string): Promise<string> {
  const ip = `ip-${crypto.randomUUID()}`;
  const magic = await post("/api/auth/magic-link", { email }, undefined, ip);
  const body = magicLinkResponseSchema.parse(await magic.json());
  const verify = await post("/api/auth/verify", { token: body.devToken }, undefined, ip);
  return authSessionResponseSchema.parse(await verify.json()).token;
}

async function userId(email: string): Promise<string> {
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!row) {
    throw new Error("missing test user");
  }
  return row.id;
}

beforeEach(async () => {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO psych_topics
     (slug, trigger, title, summary, body, reflection_prompt, insight_body, channel_id, created_at)
     VALUES ('stress', 'stress', 'Smoking when you are stressed', 'Pressure and smoking.',
     'A short explanation.', 'What happens before?', 'Maybe smoking has become your way of coping with pressure.',
     NULL, '2026-11-01T09:00:00.000Z')`,
  ).run();
});

describe("check-in idempotency", () => {
  it("replays a check-in with the same idempotency key", async () => {
    // Given a signed-in user and one idempotency key
    const token = await newSession("idempotent@example.com");
    const key = crypto.randomUUID();
    const input = { promptId: "trigger", answer: "stress" };

    // When the same check-in is sent twice
    const first = await post("/api/check-in", input, token, "local", key);
    const second = await post("/api/check-in", input, token, "local", key);

    // Then the second response is a replay, not a second check-in
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = checkInResponseSchema.parse(await first.json());
    const secondBody = checkInResponseSchema.parse(await second.json());
    expect(firstBody.pattern?.count).toBe(1);
    expect(secondBody.pattern?.count).toBe(1);

    // And the key cannot be reused for a different answer
    const conflict = await post(
      "/api/check-in",
      { promptId: "trigger", answer: "social" },
      token,
      "local",
      key,
    );
    expect(conflict.status).toBe(400);
  });

  it("returns conflict while an idempotency claim is in progress", async () => {
    // Given a fresh, incomplete claim for the same user and key
    const token = await newSession("in-progress@example.com");
    const id = await userId("in-progress@example.com");
    const key = crypto.randomUUID();
    const now = new Date();
    await env.DB.prepare(
      `INSERT INTO idempotency_keys
       (user_id, key, request_hash, response_json, created_at, expires_at)
       VALUES (?, ?, ?, '', ?, ?)`,
    )
      .bind(
        id,
        key,
        "pending",
        now.toISOString(),
        new Date(now.getTime() + 3_600_000).toISOString(),
      )
      .run();

    // When the same key is retried
    const response = await post(
      "/api/check-in",
      { promptId: "trigger", answer: "stress" },
      token,
      "local",
      key,
    );

    // Then it does not run the write twice
    expect(response.status).toBe(409);
  });

  it("releases a failed claim so the retry surfaces the operation", async () => {
    // Given a signed-in user and a claim whose operation throws
    const token = await newSession("failed-claim@example.com");
    const id = await userId("failed-claim@example.com");
    const key = crypto.randomUUID();

    // When the operation fails
    let thrown: unknown;
    try {
      await withIdempotency(
        env,
        id,
        key,
        "failed-hash",
        checkInResponseSchema,
        new Date(),
        async () => {
          throw new Error("boom");
        },
      );
    } catch (error) {
      thrown = error;
    }

    // Then the error surfaces and the pending claim is gone
    expect(thrown).toBeInstanceOf(Error);
    const row = await env.DB.prepare(
      "SELECT key FROM idempotency_keys WHERE user_id = ? AND key = ?",
    )
      .bind(id, key)
      .first<{ key: string }>();
    expect(row).toBeNull();

    // And a retry with the same key is not blocked by a 409
    const retry = await post(
      "/api/check-in",
      { promptId: "trigger", answer: "stress" },
      token,
      "local",
      key,
    );
    expect(retry.status).toBe(200);
  });

  it("does not double-write when the idempotency claim is gone", async () => {
    // Given a check-in that already committed
    const token = await newSession("dedupe-write@example.com");
    const id = await userId("dedupe-write@example.com");
    const key = crypto.randomUUID();
    const input = { promptId: "trigger", answer: "stress" };
    const first = await post("/api/check-in", input, token, "local", key);
    expect(first.status).toBe(200);

    // When the idempotency claim is removed and the same key retries
    await env.DB.prepare("DELETE FROM idempotency_keys WHERE user_id = ? AND key = ?")
      .bind(id, key)
      .run();
    const second = await post("/api/check-in", input, token, "local", key);

    // Then the deterministic check-in ID prevents a second row
    expect(second.status).toBe(200);
    const body = checkInResponseSchema.parse(await second.json());
    expect(body.pattern?.count).toBe(1);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM check_ins WHERE user_id = ?")
      .bind(id)
      .first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("takes over a stale idempotency claim", async () => {
    // Given a claim that has been abandoned for longer than the stale window
    const token = await newSession("stale@example.com");
    const id = await userId("stale@example.com");
    const key = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO idempotency_keys
       (user_id, key, request_hash, response_json, created_at, expires_at)
       VALUES (?, ?, ?, '', ?, ?)`,
    )
      .bind(
        id,
        key,
        "pending",
        "2020-01-01T00:00:00.000Z",
        new Date(Date.now() + 3_600_000).toISOString(),
      )
      .run();

    // When the same key is retried
    const response = await post(
      "/api/check-in",
      { promptId: "trigger", answer: "stress" },
      token,
      "local",
      key,
    );

    // Then the claim is taken over and the write completes
    expect(response.status).toBe(200);
    const body = checkInResponseSchema.parse(await response.json());
    expect(body.pattern?.count).toBe(1);
  });
});
