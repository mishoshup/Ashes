import Argon2, { Argon2Type, Argon2Version } from "@phi-ag/argon2";
import wasm from "@phi-ag/argon2/argon2.wasm";

const PARAMS = { memoryCost: 19_456, timeCost: 2, hashLength: 32, parallelism: 1 };
const encoder = new TextEncoder();

let instance: Promise<Argon2> | undefined;

export function getArgon2(): Promise<Argon2> {
  instance ??= WebAssembly.instantiate(wasm).then((module) => new Argon2(module));
  return instance;
}

/**
 * Mix the server-side pepper into the password with HMAC-SHA256.
 * This is the same scheme used by the reference sillyusachi API.
 */
async function applyPepper(pepper: string, password: string): Promise<string> {
  if (!pepper) {
    return password;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(password));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function hashPassword(password: string, pepper = ""): Promise<string> {
  const argon2 = await getArgon2();
  return argon2.hash(await applyPepper(pepper, password), {
    ...PARAMS,
    type: Argon2Type.Argon2id,
    version: Argon2Version.Version13,
  }).encoded;
}

export async function verifyPassword(
  password: string,
  encoded: string,
  pepper = "",
): Promise<boolean> {
  const argon2 = await getArgon2();
  return argon2.tryVerify(encoded, await applyPepper(pepper, password), Argon2Type.Argon2id)
    .success;
}

export async function burnPassword(password: string, pepper = ""): Promise<void> {
  await hashPassword(`${password}:${crypto.randomUUID()}`, pepper);
}
