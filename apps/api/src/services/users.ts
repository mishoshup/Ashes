import type { UserSummary } from "@ashes/contracts";
import type { Env } from "../types";
import { burnPassword, verifyPassword } from "./password";
import {
  magicLinkExpiry,
  newId,
  newSessionExpiry,
  randomToken,
  sessionTokenHash,
} from "../lib/crypto";

export type UserRow = {
  id: string;
  email: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_emoji: string | null;
  accent: string;
  created_at: string;
  email_verified_at: string | null;
  password_hash: string | null;
  password_updated_at: string | null;
  updated_at: string;
};

export type AuthUser = UserSummary & {
  email: string;
};

export type SessionMeta = {
  userAgent?: string | null;
  ipHash?: string | null;
};

const ACCENTS = ["#ff6a3d", "#d7a56a", "#8fa98a", "#b58cff", "#6da8ff", "#e06d8c"];

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    handle: row.handle,
    displayName: row.display_name,
    accent: row.accent,
    avatarEmoji: row.avatar_emoji,
  };
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "member";
  const words = local.replace(/[._-]+/gu, " ").trim();
  const name = words
    .split(/\s+/u)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
  return name.slice(0, 40) || "Member";
}

function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "member";
  const base = local
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 18);
  return (base.length >= 3 ? base : "member") + `_${crypto.randomUUID().slice(0, 4)}`;
}

function accentFor(email: string): string {
  let code = 0;
  for (let index = 0; index < email.length; index += 1) {
    code += email.charCodeAt(index);
  }
  return ACCENTS[code % ACCENTS.length] ?? ACCENTS[0] ?? "#ff6a3d";
}

export async function findUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

export async function findUserById(env: Env, id: string): Promise<UserRow | null> {
  return env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

async function insertUser(env: Env, email: string, now: string): Promise<UserRow> {
  const id = newId("usr");
  const handle = handleFromEmail(email);
  await env.DB.prepare(
    `INSERT INTO users (id, email, handle, display_name, bio, avatar_emoji, accent, created_at, email_verified_at, updated_at)
     VALUES (?, ?, ?, ?, '', NULL, ?, ?, ?, ?)`,
  )
    .bind(id, email, handle, displayNameFromEmail(email), accentFor(email), now, now, now)
    .run();
  const row = await findUserByEmail(env, email);
  if (!row) {
    throw new Error("User insert did not return a row");
  }
  return row;
}

export async function findOrCreateUser(
  env: Env,
  email: string,
  now: Date,
): Promise<{ user: AuthUser; isNewUser: boolean }> {
  const existing = await findUserByEmail(env, email);
  if (existing) {
    return { user: toAuthUser(existing), isNewUser: false };
  }
  try {
    const row = await insertUser(env, email, now.toISOString());
    return { user: toAuthUser(row), isNewUser: true };
  } catch (error) {
    const raced = await findUserByEmail(env, email);
    if (raced) {
      return { user: toAuthUser(raced), isNewUser: false };
    }
    throw error;
  }
}

export async function findLoginRequest(
  env: Env,
  email: string,
  requestKey: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS found FROM login_tokens WHERE email = ? AND request_key = ? LIMIT 1",
  )
    .bind(email, requestKey)
    .first<{ found: number }>();
  return row?.found === 1;
}

export async function createLoginToken(
  env: Env,
  email: string,
  now: Date,
  requestKey?: string,
): Promise<string> {
  const token = randomToken();
  const tokenHash = await sessionTokenHash(env, token);
  const createdAt = now.toISOString();
  await env.DB.prepare(
    "INSERT INTO login_tokens (token_hash, email, purpose, created_at, expires_at, request_key) VALUES (?, ?, 'magic_link', ?, ?, ?)",
  )
    .bind(tokenHash, email, createdAt, magicLinkExpiry(now), requestKey ?? null)
    .run();
  return token;
}

export async function peekLoginToken(env: Env, token: string, now: Date): Promise<string | null> {
  const tokenHash = await sessionTokenHash(env, token);
  const row = await env.DB.prepare(
    "SELECT email FROM login_tokens WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?",
  )
    .bind(tokenHash, now.toISOString())
    .first<{ email: string }>();
  return row?.email ?? null;
}

export async function finalizeLoginToken(
  env: Env,
  token: string,
  userId: string,
  now: Date,
  meta: SessionMeta = {},
): Promise<string | null> {
  const tokenHash = await sessionTokenHash(env, token);
  const sessionToken = randomToken();
  const sessionHash = await sessionTokenHash(env, sessionToken);
  const nowIso = now.toISOString();
  const consumedAt = nowIso;
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE login_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?",
    ).bind(consumedAt, tokenHash, nowIso),
    env.DB.prepare(
      `INSERT INTO sessions
         (token_hash, id, user_id, created_at, expires_at, last_seen_at, user_agent, ip_hash)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM login_tokens WHERE token_hash = ? AND consumed_at = ?)`,
    ).bind(
      sessionHash,
      newId("ses"),
      userId,
      nowIso,
      newSessionExpiry(now),
      nowIso,
      meta.userAgent ?? null,
      meta.ipHash ?? null,
      tokenHash,
      consumedAt,
    ),
  ]);
  return (results[0]?.meta.changes ?? 0) === 1 ? sessionToken : null;
}

export async function createSession(
  env: Env,
  userId: string,
  now: Date,
  meta: SessionMeta = {},
): Promise<string> {
  const token = randomToken();
  const tokenHash = await sessionTokenHash(env, token);
  await env.DB.prepare(
    `INSERT INTO sessions
       (token_hash, id, user_id, created_at, expires_at, last_seen_at, user_agent, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      tokenHash,
      newId("ses"),
      userId,
      now.toISOString(),
      newSessionExpiry(now),
      now.toISOString(),
      meta.userAgent ?? null,
      meta.ipHash ?? null,
    )
    .run();
  return token;
}

export async function findPasswordHash(env: Env, userId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(userId)
    .first<{ password_hash: string | null }>();
  return row?.password_hash ?? null;
}

export async function setPasswordAndRevokeOthers(
  env: Env,
  userId: string,
  passwordHash: string,
  currentToken: string,
  now: Date,
): Promise<void> {
  const currentHash = await sessionTokenHash(env, currentToken);
  const nowIso = now.toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_updated_at = ?, updated_at = ? WHERE id = ?",
    ).bind(passwordHash, nowIso, nowIso, userId),
    env.DB.prepare(
      `UPDATE sessions SET revoked_at = ?, revoked_reason = 'password_change'
       WHERE user_id = ? AND token_hash != ? AND revoked_at IS NULL`,
    ).bind(nowIso, userId, currentHash),
  ]);
}

export async function loginWithPassword(
  env: Env,
  email: string,
  password: string,
  now: Date,
  pepper: string,
  meta: SessionMeta = {},
): Promise<{ user: AuthUser; token: string } | null> {
  const row = await findUserByEmail(env, email);
  if (!row?.password_hash) {
    await burnPassword(password, pepper);
    return null;
  }
  const valid = await verifyPassword(password, row.password_hash, pepper);
  if (!valid) {
    return null;
  }
  const token = await createSession(env, row.id, now, meta);
  return { user: toAuthUser(row), token };
}
