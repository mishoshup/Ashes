import type { Finding, ReviewResult, Severity } from "./schema";

export type ValidationResult = {
  result: ReviewResult;
  dropped: number;
  blocking: boolean;
};

const BLOCKING: ReadonlySet<Severity> = new Set(["critical", "high"]);

export function changedFiles(diff: string): string[] {
  const files = new Set<string>();
  for (const match of diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gmu)) {
    const path = match[2];
    if (path) {
      files.add(path);
    }
  }
  return [...files];
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function validateFindings(diff: string, result: ReviewResult): ValidationResult {
  const files = new Set(changedFiles(diff));
  const normalizedDiff = normalize(diff);
  const seen = new Set<string>();
  const findings: Finding[] = [];
  let dropped = 0;

  for (const finding of result.findings) {
    const key = `${finding.ruleId}:${finding.path}:${finding.line}`;
    const evidence = normalize(finding.evidence);
    const valid =
      files.has(finding.path) &&
      evidence.length >= 4 &&
      normalizedDiff.includes(evidence) &&
      !seen.has(key);

    if (valid) {
      seen.add(key);
      findings.push(finding);
    } else {
      dropped += 1;
    }
  }

  const blocking = findings.some((finding) => BLOCKING.has(finding.severity));
  const verdict = blocking ? "request_changes" : result.verdict;
  return {
    result: { ...result, verdict, findings },
    dropped,
    blocking,
  };
}

export function isBlocking(result: ReviewResult): boolean {
  return result.findings.some((finding) => BLOCKING.has(finding.severity));
}
