import type { Env } from "../types";

export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const resetAt = new Date(now + windowSeconds * 1000).toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
     RETURNING count`,
  )
    .bind(key, resetAt, nowIso, nowIso)
    .first<{ count: number }>();
  return (row?.count ?? limit + 1) <= limit;
}
