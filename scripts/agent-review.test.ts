import { describe, expect, it } from "bun:test";

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
});
