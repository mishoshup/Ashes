import { argon2idAsync } from "@noble/hashes/argon2.js";
import { base64UrlDecode, base64UrlEncode } from "../lib/crypto";

const PARAMS = { t: 2, m: 19_456, p: 1, dkLen: 32 };
const MAX_MEMORY = 64 * 1024 * 1024;
const PHC_PATTERN =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/u;

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function derive(password: string, salt: Uint8Array, options: typeof PARAMS) {
  return argon2idAsync(new TextEncoder().encode(password), salt, {
    ...options,
    maxmem: MAX_MEMORY,
    asyncTick: 10,
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PARAMS);
  return `$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${base64UrlEncode(salt)}$${base64UrlEncode(hash)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = PHC_PATTERN.exec(encoded);
  if (!match) {
    return false;
  }
  const memory = Number(match[1]);
  const iterations = Number(match[2]);
  const parallelism = Number(match[3]);
  const salt = base64UrlDecode(match[4] ?? "");
  const expected = base64UrlDecode(match[5] ?? "");
  if (
    !salt ||
    !expected ||
    !Number.isInteger(memory) ||
    !Number.isInteger(iterations) ||
    !Number.isInteger(parallelism) ||
    memory < 8 ||
    memory > 65_536 ||
    iterations < 1 ||
    iterations > 10 ||
    parallelism < 1 ||
    parallelism > 4
  ) {
    return false;
  }
  const actual = await derive(password, salt, {
    t: iterations,
    m: memory,
    p: parallelism,
    dkLen: expected.length,
  });
  return constantTimeEqual(actual, expected);
}

export async function burnPassword(password: string): Promise<void> {
  const salt = new Uint8Array(16);
  salt.fill(1);
  await derive(password, salt, PARAMS);
}
