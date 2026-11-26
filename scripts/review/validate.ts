import type { Finding, ReviewResult, Severity } from "./schema";

export type ValidationResult = {
  result: ReviewResult;
  dropped: number;
  blocking: boolean;
};

const BLOCKING: ReadonlySet<Severity> = new Set(["critical", "high"]);

type AddedLines = Map<string, Map<number, string>>;

function parseAddedLines(diff: string): AddedLines {
  const files: AddedLines = new Map();
  let currentFile: string | null = null;
  let newLine = 0;

  for (const raw of diff.split("\n")) {
    const fileMatch = raw.match(/^diff --git a\/(.+?) b\/(.+)$/u);
    if (fileMatch?.[2]) {
      currentFile = fileMatch[2];
      files.set(currentFile, new Map());
      continue;
    }
    if (raw.startsWith("+++ b/")) {
      currentFile = raw.slice(6);
      files.set(currentFile, new Map());
      continue;
    }
    if (raw.startsWith("@@")) {
      const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u);
      if (hunk?.[1]) {
        newLine = Number(hunk[1]);
      }
      continue;
    }
    if (!currentFile) {
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      files.get(currentFile)?.set(newLine, raw.slice(1));
      newLine += 1;
    } else if (raw.startsWith(" ") || raw === "") {
      newLine += 1;
    }
  }

  return files;
}

export function changedFiles(diff: string): string[] {
  return [...parseAddedLines(diff).keys()];
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeEvidence(value: string): string {
  return normalize(value).replace(/^\+/u, "");
}

export function validateFindings(diff: string, result: ReviewResult): ValidationResult {
  const added = parseAddedLines(diff);
  const seen = new Set<string>();
  const findings: Finding[] = [];
  let dropped = 0;

  for (const finding of result.findings) {
    const lines = added.get(finding.path);
    const evidence = normalizeEvidence(finding.evidence);
    const lineText = lines?.get(finding.line);
    const window = [finding.line, finding.line + 1, finding.line + 2]
      .map((line) => lines?.get(line) ?? "")
      .filter(Boolean)
      .join(" ");
    const key = `${finding.ruleId}:${finding.path}:${finding.line}`;
    const valid =
      lines !== undefined &&
      lineText !== undefined &&
      evidence.length >= 4 &&
      (normalize(lineText).includes(evidence) || normalize(window).includes(evidence)) &&
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
