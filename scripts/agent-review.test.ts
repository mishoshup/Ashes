import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

import { escapeWorkflowCommand, postCommentOrFail, requireCommentCredentials } from "./review/gate";

type Result = { code: number; stdout: string; stderr: string };

async function run(args: string[], env: Record<string, string>): Promise<Result> {
  const child = Bun.spawn(["bun", "scripts/agent-review.ts", ...args], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, stdout, stderr };
}

describe("agent review gate", () => {
  it("fails in CI when the reviewer is not configured", async () => {
    // Given CI without a review key or model
    // When the review runs
    const result = await run(["--ci"], { REVIEW_API_KEY: "", REVIEW_MODEL: "" });

    // Then the review fails loudly instead of reporting a pass
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Agent review did not run");
  });

  it("skips locally when the reviewer is not configured", async () => {
    // Given a local run without a review key or model
    // When the review runs
    const result = await run([], { REVIEW_API_KEY: "", REVIEW_MODEL: "" });

    // Then it says so, without pretending CI reviewed the diff
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Local review skipped");
  });

  it("fails in CI when the filtered diff is too large", async () => {
    // Given a diff over the review budget
    // When the review runs in CI
    const result = await runWithDiff(
      `diff --git a/apps/api/src/huge.ts b/apps/api/src/huge.ts
--- a/apps/api/src/huge.ts
+++ b/apps/api/src/huge.ts
@@ -1 +1 @@
+${"a".repeat(130_000)}
`,
    );

    // Then the job fails instead of silently skipping
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("diff is");
  });

  it("fails in CI when the diff is empty", async () => {
    // Given no reviewable diff
    // When the review runs in CI
    const result = await runWithDiff("");

    // Then the job fails instead of silently skipping
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("empty diff");
  });

  it("escapes workflow command data and requires comment credentials in CI", () => {
    // Given a message containing command separators
    // When it is escaped for a GitHub annotation
    expect(escapeWorkflowCommand("a%\nb\r")).toBe("a%25%0Ab%0D");

    // Then CI refuses to run without a comment target, while local runs may continue
    expect(() => requireCommentCredentials({ ci: true })).toThrow();
    expect(() => requireCommentCredentials({ ci: false })).not.toThrow();
  });

  it("does not fail locally when the diff is oversized", async () => {
    // Given a diff over the review budget
    // When the review runs locally
    const result = await runWithDiff(
      `diff --git a/apps/api/src/huge.ts b/apps/api/src/huge.ts
--- a/apps/api/src/huge.ts
+++ b/apps/api/src/huge.ts
@@ -1 +1 @@
+${"a".repeat(130_000)}
`,
      [],
    );

    // Then it reports the size without failing the command
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("diff is");
  });

  it("fails when the review comment cannot be posted", async () => {
    // Given a GitHub comment write that fails
    const previousCode = process.exitCode;
    const previousActions = process.env.GITHUB_ACTIONS;
    process.env.GITHUB_ACTIONS = "";

    try {
      // When the comment is posted
      await postCommentOrFail(async () => {
        throw new Error("boom");
      });

      // Then the review fails loudly
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousCode ?? 0;
      if (previousActions === undefined) {
        delete process.env.GITHUB_ACTIONS;
      } else {
        process.env.GITHUB_ACTIONS = previousActions;
      }
    }
  });
});

async function runWithDiff(content: string, args: string[] = ["--ci"]): Promise<Result> {
  const dir = mkdtempSync(join(tmpdir(), "ashes-review-"));
  const file = join(dir, "review.diff");
  writeFileSync(file, content);
  try {
    return await run(args, {
      REVIEW_API_KEY: "test-key",
      REVIEW_MODEL: "test-model",
      REVIEW_DIFF_FILE: file,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
