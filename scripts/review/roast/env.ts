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
