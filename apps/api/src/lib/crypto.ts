import type { Env } from "../types";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

export function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sessionTokenHash(env: Env, token: string): Promise<string> {
  return sha256Hex(`${env.SESSION_PEPPER ?? ""}:${token}`);
}

export function newSessionExpiry(now: Date): string {
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export function magicLinkExpiry(now: Date): string {
  return new Date(now.getTime() + 10 * 60 * 1000).toISOString();
}
