import type { SessionSummary } from "@ashes/contracts";
import type { Context } from "hono";

import { hashIp, newId, newSessionExpiry, randomToken, sessionTokenHash } from "../lib/crypto";
import type { AppEnv, Env } from "../types";
import { findUserById, toAuthUser, type AuthUser, type SessionMeta } from "./users";

export type SessionRecord = {
  id: string | null;
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  user_agent: string | null;
  ip_hash: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  rotated_from: string | null;
  version: number;
};

export type AuthenticatedSession = {
  user: AuthUser;
  session: SessionRecord;
};

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const REUSE_GRACE_MS = 60 * 1000;

export async function sessionMetaFromRequest(c: Context<AppEnv>): Promise<SessionMeta> {
  const userAgent = c.req.header("User-Agent")?.slice(0, 200) ?? null;
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  return {
    userAgent,
    ipHash: await hashIp(c.env, ip),
  };
}

export async function findSession(
  env: Env,
  token: string,
  now: Date,
): Promise<AuthenticatedSession | null> {
  const tokenHash = await sessionTokenHash(env, token);
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<SessionRecord>();

  if (!session) {
    return null;
  }
  if (session.revoked_at) {
    if (session.revoked_reason === "rotated" && session.id) {
      const rotatedAt = Date.parse(session.revoked_at);
      const isOutsideGrace =
        !Number.isFinite(rotatedAt) || now.getTime() - rotatedAt > REUSE_GRACE_MS;
      if (isOutsideGrace) {
        await revokeReplacementChain(env, session.id, now);
      }
    }
    return null;
  }
  if (session.expires_at <= now.toISOString()) {
    return null;
  }

  const user = await findUserById(env, session.user_id);
  if (!user) {
    return null;
  }
  return { user: toAuthUser(user), session };
}

export async function touchSession(env: Env, tokenHash: string, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - LAST_SEEN_THROTTLE_MS).toISOString();
  await env.DB.prepare(
    `UPDATE sessions SET last_seen_at = ?
     WHERE token_hash = ? AND revoked_at IS NULL AND last_seen_at < ?`,
  )
    .bind(now.toISOString(), tokenHash, cutoff)
    .run();
}

export async function revokeSession(
  env: Env,
  token: string,
  reason: string,
  now: Date,
): Promise<boolean> {
  const tokenHash = await sessionTokenHash(env, token);
  const result = await env.DB.prepare(
    `UPDATE sessions SET revoked_at = ?, revoked_reason = ?
     WHERE token_hash = ? AND revoked_at IS NULL`,
  )
    .bind(now.toISOString(), reason, tokenHash)
    .run();
  return result.meta.changes > 0;
}

async function revokeReplacementChain(env: Env, rotatedFrom: string, now: Date): Promise<void> {
  await env.DB.prepare(
    `WITH RECURSIVE chain(id) AS (
       SELECT id FROM sessions WHERE rotated_from = ?
       UNION
       SELECT s.id FROM sessions s JOIN chain c ON s.rotated_from = c.id
     )
     UPDATE sessions SET revoked_at = ?, revoked_reason = 'reuse'
     WHERE id IN (SELECT id FROM chain) AND revoked_at IS NULL`,
  )
    .bind(rotatedFrom, now.toISOString())
    .run();
}

export async function listSessions(
  env: Env,
  userId: string,
  currentToken: string,
  now: Date,
): Promise<SessionSummary[]> {
  const currentHash = await sessionTokenHash(env, currentToken);
  const rows = await env.DB.prepare(
    `SELECT id, token_hash, created_at, last_seen_at, expires_at, user_agent
     FROM sessions
     WHERE user_id = ? AND id IS NOT NULL AND revoked_at IS NULL AND expires_at > ?
     ORDER BY last_seen_at DESC`,
  )
    .bind(userId, now.toISOString())
    .all<{
      id: string;
      token_hash: string;
      created_at: string;
      last_seen_at: string;
      expires_at: string;
      user_agent: string | null;
    }>();

  return rows.results.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    userAgent: row.user_agent,
    isCurrent: row.token_hash === currentHash,
  }));
}

export async function revokeSessionById(
  env: Env,
  userId: string,
  sessionId: string,
  now: Date,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE sessions SET revoked_at = ?, revoked_reason = 'revoked'
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(now.toISOString(), sessionId, userId)
    .run();
  return result.meta.changes > 0;
}

export async function revokeAllSessions(
  env: Env,
  userId: string,
  currentToken: string,
  shouldKeepCurrent: boolean,
  now: Date,
): Promise<number> {
  const currentHash = await sessionTokenHash(env, currentToken);
  const result = shouldKeepCurrent
    ? await env.DB.prepare(
        `UPDATE sessions SET revoked_at = ?, revoked_reason = 'revoke_all'
         WHERE user_id = ? AND token_hash != ? AND revoked_at IS NULL`,
      )
        .bind(now.toISOString(), userId, currentHash)
        .run()
    : await env.DB.prepare(
        `UPDATE sessions SET revoked_at = ?, revoked_reason = 'revoke_all'
         WHERE user_id = ? AND revoked_at IS NULL`,
      )
        .bind(now.toISOString(), userId)
        .run();
  return result.meta.changes;
}

export async function rotateSession(
  env: Env,
  userId: string,
  currentToken: string,
  now: Date,
  meta: SessionMeta,
): Promise<string | null> {
  const currentHash = await sessionTokenHash(env, currentToken);
  const current = await env.DB.prepare(
    `SELECT id, expires_at, revoked_at FROM sessions WHERE token_hash = ? AND user_id = ?`,
  )
    .bind(currentHash, userId)
    .first<{ id: string | null; expires_at: string; revoked_at: string | null }>();

  if (!current || current.revoked_at || current.expires_at <= now.toISOString()) {
    return null;
  }

  const token = randomToken();
  const tokenHash = await sessionTokenHash(env, token);
  const nowIso = now.toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE sessions SET revoked_at = ?, revoked_reason = 'rotated'
       WHERE token_hash = ? AND revoked_at IS NULL`,
    ).bind(nowIso, currentHash),
    env.DB.prepare(
      `INSERT INTO sessions
         (token_hash, id, user_id, created_at, expires_at, last_seen_at, user_agent, ip_hash, rotated_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      tokenHash,
      newId("ses"),
      userId,
      nowIso,
      newSessionExpiry(now),
      nowIso,
      meta.userAgent ?? null,
      meta.ipHash ?? null,
      current.id,
    ),
  ]);

  if ((results[0]?.meta.changes ?? 0) !== 1) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return token;
}
