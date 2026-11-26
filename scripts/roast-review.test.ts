import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

type Result = { code: number; stderr: string };

async function run(args: string[], env: Record<string, string | undefined>): Promise<Result> {
  const child = Bun.spawn([process.execPath, "scripts/roast-review.ts", ...args], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited]);
  return { code, stderr };
}

function fakeRoast(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "ashes-fake-roast-"));
  const path = join(dir, "roast");
  writeFileSync(path, '#!/bin/sh\n[ "$1" = "--version" ] && echo "roast version v1.5.1"\nexit 0\n');
  chmodSync(path, 0o755);
  return { dir, path };
}

describe("Roast review orchestration", () => {
  it("fails when the review key is missing", async () => {
    const fake = fakeRoast();
    try {
      // Given a Roast binary but no review key
      const result = await run([], {
        PATH: `${fake.dir}:${process.env.PATH ?? ""}`,
        REVIEW_API_KEY: "",
      });

      // Then it fails loudly
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("REVIEW_API_KEY");
    } finally {
      rmSync(fake.dir, { recursive: true, force: true });
    }
  });

  it("fails in CI without a pull request number", async () => {
    const fake = fakeRoast();
    try {
      // Given a key but no PR number
      const result = await run(["--ci"], {
        PATH: `${fake.dir}:${process.env.PATH ?? ""}`,
        REVIEW_API_KEY: "test-key",
        PR_NUMBER: "",
      });

      // Then it fails before calling the model
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("PR_NUMBER");
    } finally {
      rmSync(fake.dir, { recursive: true, force: true });
    }
  });

  it("fails when the pinned Roast binary is missing", async () => {
    const empty = mkdtempSync(join(tmpdir(), "ashes-empty-path-"));
    try {
      // Given a PATH with no roast binary
      const result = await run([], {
        PATH: empty,
        REVIEW_API_KEY: "test-key",
      });

      // Then the install hint is shown
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("v1.5.1 is not installed");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
