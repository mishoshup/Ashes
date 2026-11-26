import { resolve, sep } from "node:path";

export function extractReportPath(stderr: string): string | null {
  const matches = [...stderr.matchAll(/report (.+?)\s*$/gm)];
  return matches.at(-1)?.[1]?.trim() ?? null;
}

export function extractReportFromStderr(stderr: string): string {
  const start = stderr.indexOf("## ");
  return start >= 0 ? stderr.slice(start).trim() : "";
}

export function isSafeReportPath(path: string, root: string): boolean {
  const base = resolve(root);
  const target = resolve(path);
  return target.startsWith(`${base}${sep}`) && target.endsWith(`${sep}report.md`);
}
