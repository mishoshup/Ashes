import type { UserSummary } from "@ashes/contracts";
import type { Env } from "../types";
import {
  magicLinkExpiry,
  newId,
  newSessionExpiry,
  randomToken,
  sessionTokenHash,
} from "../lib/crypto";

type UserRow = {
  id: string;
  email: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_emoji: string | null;
  accent: string;
  created_at: string;
  email_verified_at: string | null;
  updated_at: string;
};

export type AuthUser = UserSummary & {
  email: string;
};

const ACCENTS = ["#ff6a3d", "#d7a56a", "#8fa98a", "#b58cff", "#6da8ff", "#e06d8c"];

function toAuthUser(row: UserRow): AuthUser {
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

export async function createLoginToken(env: Env, email: string, now: Date): Promise<string> {
  const token = randomToken();
  const tokenHash = await sessionTokenHash(env, token);
  const createdAt = now.toISOString();
  await env.DB.prepare(
    "INSERT INTO login_tokens (token_hash, email, purpose, created_at, expires_at) VALUES (?, ?, 'magic_link', ?, ?)",
  )
    .bind(tokenHash, email, createdAt, magicLinkExpiry(now))
    .run();
  return token;
}

export async function consumeLoginToken(
  env: Env,
  token: string,
  now: Date,
): Promise<string | null> {
  const tokenHash = await sessionTokenHash(env, token);
  const row = await env.DB.prepare(
    `UPDATE login_tokens SET consumed_at = ?
     WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?
     RETURNING email`,
  )
    .bind(now.toISOString(), tokenHash, now.toISOString())
    .first<{ email: string }>();
  return row?.email ?? null;
}

export async function createSession(env: Env, userId: string, now: Date): Promise<string> {
  const token = randomToken();
  const tokenHash = await sessionTokenHash(env, token);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(tokenHash, userId, now.toISOString(), newSessionExpiry(now), now.toISOString())
    .run();
  return token;
}

export async function findSessionUser(
  env: Env,
  token: string,
  now: Date,
): Promise<AuthUser | null> {
  const tokenHash = await sessionTokenHash(env, token);
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now.toISOString())
    .first<UserRow>();
  return row ? toAuthUser(row) : null;
}

export async function revokeSession(env: Env, token: string): Promise<void> {
  const tokenHash = await sessionTokenHash(env, token);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
