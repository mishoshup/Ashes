import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { writeRoastConfig } from "./review/roast/config";
import {
  composeFinderPrompt,
  composeVerifierPrompt,
  loadAshesRules,
  loadRoastCore,
} from "./review/roast/prompts";
import { fail, postCommentOrFail, requireCommentCredentials } from "./review/gate";
import { postReviewComment } from "./review/github";
import { buildRoastEnv, reviewEnvSchema } from "./review/roast/env";
import { resolveReportBody } from "./review/roast/report";

const isCi = process.argv.includes("--ci");
const parsedEnv = reviewEnvSchema.safeParse(process.env);
const env = parsedEnv.success ? parsedEnv.data : {};
const base = env.PR_BASE_SHA ?? "origin/main";
const pr = env.PR_NUMBER;
const repo = env.GITHUB_REPOSITORY;
const token = env.GITHUB_TOKEN;
const baseUrl = env.REVIEW_BASE_URL || "https://api.commandcode.ai/provider/v1";
const model = env.ROAST_MODEL || "deepseek/deepseek-v4.1-flash";
const task = "Review this pull request against the Ashes rules.";

async function main(): Promise<void> {
  let hasRoast = true;
  try {
    const probe = Bun.spawnSync(["roast", "--version"], { env: buildRoastEnv(process.env) });
    hasRoast = probe.exitCode === 0 && probe.stdout.toString().includes("v1.5.1");
  } catch {
    hasRoast = false;
  }
  if (!hasRoast) {
    fail("Roast v1.5.1 is not installed. Install the pinned binary before reviewing.");
    return;
  }
  if (!parsedEnv.success) {
    const fields = parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ");
    fail(`Roast review did not run: invalid environment (${fields}).`);
    return;
  }
  if (!env.REVIEW_API_KEY) {
    fail("Roast review did not run: REVIEW_API_KEY is not configured.");
    return;
  }
  if (isCi) {
    if (!pr) {
      fail("Roast review did not run: PR_NUMBER is required in CI.");
      return;
    }
    requireCommentCredentials({ isCi, token, repo, pr });
  }

  const [core, rules] = await Promise.all([
    loadRoastCore(),
    loadAshesRules(base, { shouldAllowWorktreeRules: !isCi }),
  ]);
  const dir = join(process.env.RUNNER_TEMP ?? tmpdir(), "ashes-roast");
  mkdirSync(dir, { recursive: true });
  const finderPath = join(dir, "finder-core.md");
  const verifierPath = join(dir, "verifier-core.md");
  writeFileSync(finderPath, composeFinderPrompt(core.finder, rules));
  writeFileSync(verifierPath, composeVerifierPrompt(core.verifier, rules));
  const configPath = writeRoastConfig({ dir, finderPath, verifierPath, baseUrl, model });

  // Roast reports every finding. --max-severity is the exit-code threshold, not a cap.
  const args = [
    "roast",
    "review",
    "--config",
    configPath,
    "--mode",
    "code",
    "--max-severity",
    "MEDIUM",
    "--format",
    "markdown",
    "--task",
    task,
  ];
  if (isCi && pr) {
    args.push("--pr", pr, "--base", base);
  } else {
    args.push("--base", base);
  }

  const child = Bun.spawn(args, {
    env: buildRoastEnv(process.env),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
  const reportRoot = join(dataHome, "roast", "runs");
  const body = await resolveReportBody({
    stdout,
    stderr,
    reportRoot,
    readFile: (file) => Bun.file(file).text(),
  });
  if (!body.trim()) {
    const detail = stderr.trim().split("\n").slice(-20).join(" | ");
    fail(`Roast review did not run: no report was produced (exit ${code}). ${detail}`);
    return;
  }

  if (isCi && token && repo && pr) {
    await postCommentOrFail(() => postReviewComment({ token, repo, pr, body }));
  } else {
    console.log(body);
  }

  if (code !== 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  fail(`Roast review failed: ${error instanceof Error ? error.message : String(error)}`);
}
