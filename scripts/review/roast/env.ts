import { z } from "zod";

export const reviewEnvSchema = z.object({
  PR_BASE_SHA: z
    .string()
    .regex(/^[A-Za-z0-9._/-]+$/u)
    .optional(),
  PR_NUMBER: z.string().regex(/^\d+$/u).optional(),
  GITHUB_REPOSITORY: z
    .string()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)
    .optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  REVIEW_API_KEY: z.string().min(1).optional(),
  REVIEW_BASE_URL: z.string().url().optional(),
  ROAST_MODEL: z.string().min(1).optional(),
});

const ALLOWED = new Set([
  "PATH",
  "HOME",
  "TMPDIR",
  "REVIEW_API_KEY",
  "REVIEW_BASE_URL",
  "ROAST_MODEL",
  "XDG_DATA_HOME",
  "XDG_CONFIG_HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
]);

export function buildRoastEnv(source: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && ALLOWED.has(key)) {
      env[key] = value;
    }
  }
  return env;
}
