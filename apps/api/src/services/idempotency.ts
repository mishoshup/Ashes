import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { Env } from "../types";

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const TTL_MS = 24 * 60 * 60 * 1000;
const STALE_CLAIM_MS = 60 * 1000;

export async function hashRequest(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Claims the key atomically before running the operation, so two concurrent
 * retries cannot both execute the write. The response is filled in afterwards.
 *
 * A crashed claim can be taken over after STALE_CLAIM_MS. The operation and the
 * response update are not one transaction; a crash after the write but before
 * the update can still duplicate after the stale window. Keep the write itself
 * idempotent where it matters.
 */
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

  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + TTL_MS).toISOString();
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const claim = await env.DB.prepare(
      `INSERT INTO idempotency_keys
         (user_id, key, request_hash, response_json, created_at, expires_at)
       VALUES (?, ?, ?, '', ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET
         request_hash = excluded.request_hash,
         response_json = '',
         created_at = excluded.created_at,
         expires_at = excluded.expires_at
       WHERE idempotency_keys.expires_at <= excluded.created_at
          OR (idempotency_keys.response_json = '' AND idempotency_keys.created_at <= ?)`,
    )
      .bind(userId, key, requestHash, createdAt, expiresAt, staleBefore)
      .run();

    if (claim.meta.changes > 0) {
      let value: T;
      try {
        value = await run();
      } catch (error) {
        await env.DB.prepare(
          `DELETE FROM idempotency_keys
           WHERE user_id = ? AND key = ? AND response_json = '' AND created_at = ?`,
        )
          .bind(userId, key, createdAt)
          .run();
        throw error;
      }

      await env.DB.prepare(
        `UPDATE idempotency_keys SET response_json = ?
         WHERE user_id = ? AND key = ? AND created_at = ?`,
      )
        .bind(JSON.stringify(value), userId, key, createdAt)
        .run();

      return value;
    }

    const existing = await env.DB.prepare(
      `SELECT request_hash, response_json FROM idempotency_keys
       WHERE user_id = ? AND key = ?`,
    )
      .bind(userId, key)
      .first<{ request_hash: string; response_json: string }>();

    // The owner may have released a failed claim between our INSERT and SELECT.
    // The row is free, so try the claim once more instead of reporting 409.
    if (!existing) {
      continue;
    }
    if (existing.response_json === "") {
      throw new HTTPException(409, { message: "Request in progress. Try again in a moment." });
    }
    if (existing.request_hash !== requestHash) {
      throw new HTTPException(400, { message: "Idempotency key reused with a different request" });
    }
    const parsed: unknown = JSON.parse(existing.response_json);
    return schema.parse(parsed);
  }

  throw new HTTPException(409, { message: "Request in progress. Try again in a moment." });
}
