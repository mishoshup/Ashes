import { Glob } from "bun";

const SOURCE_ROOTS = ["apps/api/src", "packages"];
const FORBIDDEN = [
  { pattern: /\bbun:sqlite\b/, reason: "Use D1; Bun SQLite is not available on Workers." },
  {
    pattern: /\bBun\.(password|file|serve|CryptoHasher)\b/,
    reason: "Use Web Crypto and Workers bindings.",
  },
  { pattern: /from\s+["']node:/, reason: "Node builtins are not guaranteed on Workers." },
  {
    pattern: /\bsharp\b/,
    reason: "sharp is a native module; use Cloudflare Images or client compression.",
  },
  { pattern: /\bany\b/, reason: "No explicit any. Model the type or use unknown + narrowing." },
  { pattern: /@ts-(ignore|nocheck)/, reason: "Do not suppress type errors." },
  { pattern: /\bconsole\.log\b/, reason: "Use the structured logger; console.log is not allowed." },
];

const ALLOW_FILE_SIZE = new Set(["apps/api/src/db/schema.ts"]);
const MAX_LINES = 300;

const failures: string[] = [];

const files: string[] = [];
for (const root of SOURCE_ROOTS) {
  files.push(...(await Array.fromAsync(new Glob(`${root}/**/*.{ts,tsx}`).scan("."))));
}

const sources = await Promise.all(
  files.map(async (fullPath) => ({ fullPath, source: await Bun.file(fullPath).text() })),
);

for (const { fullPath, source } of sources) {
  if (fullPath.includes("/test/") || fullPath.includes(".test.")) {
    continue;
  }
  const lines = source.split("\n").length;
  if (lines > MAX_LINES && !ALLOW_FILE_SIZE.has(fullPath)) {
    failures.push(`${fullPath}: ${lines} lines (max ${MAX_LINES})`);
  }
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(source)) {
      failures.push(`${fullPath}: ${rule.reason}`);
    }
  }
  if (fullPath.startsWith("apps/api/") && /from\s+["'][^"']*apps\/mobile/.test(source)) {
    failures.push(`${fullPath}: API must not import mobile code.`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error(`\n${failures.length} architecture violation(s).`);
  process.exit(1);
}

console.log("architecture: ok");
