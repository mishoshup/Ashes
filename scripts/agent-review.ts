import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { filterDiff } from "./review/diff";
import { fail } from "./review/gate";
import { parseReviewJson } from "./review/parse";
import { buildSystemPrompt, buildUserPrompt, loadRules } from "./review/prompt";
import { reviewResultSchema } from "./review/schema";
import { sanitizeInline } from "./review/sanitize";
import { validateFindings } from "./review/validate";

const COMMENT_MARKER = "<!-- ashes-agent-review -->";
const CACHE_DIR = ".cache/agent-review";
const MAX_DIFF_CHARS = 120_000;

type Env = {
  ci: boolean;
  apiKey?: string;
  baseUrl: string;
  model?: string;
  token?: string;
  repo?: string;
  pr?: string;
  diffFile?: string;
};

const apiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      }),
    )
    .min(1),
});

const commentSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
});

function readEnv(): Env {
  return {
    ci: process.argv.includes("--ci"),
    apiKey: process.env.REVIEW_API_KEY,
    baseUrl: (process.env.REVIEW_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/u, ""),
    model: process.env.REVIEW_MODEL,
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPOSITORY,
    pr: process.env.PR_NUMBER,
    diffFile: process.env.REVIEW_DIFF_FILE,
  };
}

async function run(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${command.join(" ")} failed (${code}): ${stderr.trim()}`);
  }
  return stdout;
}

async function getDiff(env: Env): Promise<string> {
  if (env.diffFile) {
    return Bun.file(env.diffFile).text();
  }
  if (env.ci) {
    if (!env.pr) {
      throw new Error("PR_NUMBER is required in CI");
    }
    return run(["gh", "pr", "diff", env.pr]);
  }
  const base = process.env.REVIEW_BASE ?? "origin/main";
  let mergeBase: string;
  try {
    mergeBase = (await run(["git", "merge-base", base, "HEAD"])).trim();
  } catch {
    mergeBase = (await run(["git", "merge-base", "main", "HEAD"])).trim();
  }
  return run(["git", "diff", mergeBase]);
}

function cachePath(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

function readCache(key: string): unknown {
  try {
    return JSON.parse(readFileSync(cachePath(key), "utf8")) as unknown;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(key), JSON.stringify(value, null, 2));
}

async function callModel(env: Env, system: string, user: string): Promise<unknown> {
  const response = await fetch(`${env.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Review API returned ${response.status}`);
  }
  const parsed = apiResponseSchema.parse(await response.json());
  const content = parsed.choices[0]?.message.content;
  if (!content) {
    throw new Error("Review API returned no content");
  }
  return parseReviewJson(content);
}

function renderComment(
  result: ReturnType<typeof reviewResultSchema.parse>,
  meta: { dropped: number; model: string; diffKey: string },
): string {
  const lines = [
    COMMENT_MARKER,
    "## Ashes agent review",
    `**Verdict:** ${result.verdict}`,
    "",
    sanitizeInline(result.summary, 1200),
    "",
    `Model: \`${meta.model}\` · diff \`${meta.diffKey.slice(0, 12)}\` · ${meta.dropped} unverifiable finding(s) dropped`,
  ];
  if (result.findings.length === 0) {
    lines.push("", "No verified rule violations.");
  } else {
    lines.push("", "| Severity | Rule | Location |", "|---|---|---|");
    for (const finding of result.findings) {
      lines.push(
        `| ${finding.severity} | ${sanitizeInline(finding.ruleId, 32)} | \`${sanitizeInline(finding.path, 200)}:${finding.line}\` |`,
      );
    }
    for (const finding of result.findings) {
      lines.push(
        "",
        `### ${finding.severity.toUpperCase()} · ${sanitizeInline(finding.ruleId, 32)}`,
        `\`${sanitizeInline(finding.path, 200)}:${finding.line}\``,
        "",
        `Evidence: \`${sanitizeInline(finding.evidence, 400)}\``,
        "",
        sanitizeInline(finding.why, 600),
        "",
        `Fix: ${sanitizeInline(finding.fix, 600)}`,
      );
    }
  }
  lines.push(
    "",
    "Deterministic checks run separately in the `ci` workflow. This review is read-only and cannot merge. Human approval is required.",
  );
  return lines.join("\n");
}

async function postComment(env: Env, body: string): Promise<void> {
  if (!env.token || !env.repo || !env.pr) {
    console.log("No GitHub token/repo/PR; printing review instead of posting.");
    console.log(body);
    return;
  }
  const headers = {
    Authorization: `Bearer ${env.token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const listResponse = await fetch(
    `https://api.github.com/repos/${env.repo}/issues/${env.pr}/comments?per_page=100`,
    { headers },
  );
  if (!listResponse.ok) {
    throw new Error(`GitHub comment list failed: ${listResponse.status}`);
  }
  const comments = z.array(commentSchema).parse(await listResponse.json());
  const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));
  const url = existing
    ? `https://api.github.com/repos/${env.repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${env.repo}/issues/${env.pr}/comments`;
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers,
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(`GitHub comment write failed: ${response.status}`);
  }
}

async function main(): Promise<void> {
  const env = readEnv();
  if (!env.apiKey || !env.model) {
    const message = "Agent review did not run: REVIEW_API_KEY or REVIEW_MODEL is not configured.";
    if (env.ci) {
      fail(message);
    } else {
      console.log(`${message} Local review skipped.`);
    }
    return;
  }

  const rawDiff = await getDiff(env);
  const filtered = filterDiff(rawDiff);
  const diff = filtered.diff;
  if (!diff.trim()) {
    const message = "Agent review did not run: empty diff.";
    if (env.ci) {
      fail(message);
    } else {
      console.log(message);
    }
    return;
  }
  if (filtered.deletedFiles > 0) {
    console.log(`Agent review: collapsed ${filtered.deletedFiles} deleted file(s).`);
  }
  if (filtered.removedFiles > 0) {
    console.log(`Agent review: skipped ${filtered.removedFiles} lockfile/generated/asset file(s).`);
  }
  if (diff.length > MAX_DIFF_CHARS) {
    fail(
      `Agent review did not run: diff is ${diff.length} chars (max ${MAX_DIFF_CHARS}). Split the PR.`,
    );
    return;
  }

  const diffKey = new Bun.CryptoHasher("sha256").update(`${env.model}\n${diff}`).digest("hex");
  const cached = readCache(diffKey);
  const result = cached
    ? reviewResultSchema.parse(cached)
    : reviewResultSchema.parse(
        await callModel(
          env,
          buildSystemPrompt(await loadRules()),
          buildUserPrompt(diff, crypto.randomUUID()),
        ),
      );

  if (!cached) {
    writeCache(diffKey, result);
  }

  const validated = validateFindings(diff, result);
  const comment = renderComment(validated.result, {
    dropped: validated.dropped,
    model: env.model,
    diffKey,
  });

  if (env.ci) {
    try {
      await postComment(env, comment);
    } catch (error) {
      fail(
        `Agent review comment failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    console.log(comment);
  }

  console.log(
    `Agent review: ${validated.result.findings.length} verified finding(s), ${validated.dropped} dropped, blocking=${validated.blocking}.`,
  );
  if (validated.blocking) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  fail(`Agent review failed: ${error instanceof Error ? error.message : String(error)}`);
}
