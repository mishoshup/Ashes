import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { Env } from "../types";

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const TTL_MS = 24 * 60 * 60 * 1000;

export async function hashRequest(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function withIdempotency<T>(
  env: Env,
  userId: string,
  key: string | undefined,
  requestHash: string,
  schema: z.ZodType<T>,
  now: Date,
  run: () => Promise<T>,
): Promise<T> {
  if (!key) {
    return run();
  }
  if (!KEY_PATTERN.test(key)) {
    throw new HTTPException(400, { message: "Invalid idempotency key" });
  }

  const existing = await env.DB.prepare(
    `SELECT request_hash, response_json FROM idempotency_keys
     WHERE user_id = ? AND key = ? AND expires_at > ?`,
  )
    .bind(userId, key, now.toISOString())
    .first<{ request_hash: string; response_json: string }>();

  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new HTTPException(400, { message: "Idempotency key reused with a different request" });
    }
    const parsed: unknown = JSON.parse(existing.response_json);
    return schema.parse(parsed);
  }

  const value = await run();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO idempotency_keys
     (user_id, key, request_hash, response_json, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      userId,
      key,
      requestHash,
      JSON.stringify(value),
      now.toISOString(),
      new Date(now.getTime() + TTL_MS).toISOString(),
    )
    .run();

  return value;
}
