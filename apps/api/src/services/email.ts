import type { Env } from "../types";

export async function verifyTurnstile(
  env: Env,
  token: string | undefined,
  remoteIp: string | undefined,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) {
    return true;
  }
  if (!token) {
    return false;
  }
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  if (remoteIp) {
    form.set("remoteip", remoteIp);
  }
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    return false;
  }
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("success" in result)) {
    return false;
  }
  return Boolean(result.success);
}

export async function sendMagicLink(env: Env, email: string, url: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email,
      subject: "Sign in to Ashes",
      text: `Open this link to sign in to Ashes. It expires in 10 minutes.\n\n${url}\n\nIf you did not request this, ignore this email.`,
    }),
  });
  return response.ok;
}
