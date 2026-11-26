import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ROAST_VERSION = "v1.5.1";
export const FINDER_CORE_SHA = "da4ee336853691002d3d7fe89aa2e1a42149721d0412e4cc91ef4346c88f90d9";
export const VERIFIER_CORE_SHA = "0cccdef5cc0775ea6bcec57d951d9c04748f29bf0e3f68262b79bc984e662c36";

const CACHE_DIR = join(homedir(), ".cache", "ashes-roast", ROAST_VERSION);

function digestSha256(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

async function fetchPinned(path: string, expected: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachedPath = join(CACHE_DIR, path.replaceAll("/", "_"));
  try {
    const cached = readFileSync(cachedPath, "utf8");
    if (digestSha256(cached) === expected) {
      return cached;
    }
  } catch {
    // no cache
  }

  const url = `https://raw.githubusercontent.com/bluesky-social/roast/${ROAST_VERSION}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch pinned Roast prompt ${path} (${response.status})`);
  }
  const text = await response.text();
  const actual = digestSha256(text);
  if (actual !== expected) {
    throw new Error(
      `Pinned Roast prompt ${path} changed: expected ${expected}, got ${actual}. Review the new prompt before bumping.`,
    );
  }
  writeFileSync(cachedPath, text);
  return text;
}

export async function loadRoastCore(): Promise<{ finder: string; verifier: string }> {
  const [finder, verifier] = await Promise.all([
    fetchPinned("internal/prompts/templates/finder_core.tmpl", FINDER_CORE_SHA),
    fetchPinned("internal/prompts/templates/verifier_system.tmpl", VERIFIER_CORE_SHA),
  ]);
  return { finder, verifier };
}

export async function loadAshesRules(
  base: string,
  options: { allowWorkingTree: boolean },
): Promise<string> {
  try {
    const child = Bun.spawn(["git", "show", `${base}:scripts/review/roast/ashes-rules.md`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
    if (code === 0 && stdout.trim()) {
      return stdout;
    }
  } catch {
    // Fall through to the explicit policy below.
  }

  if (!options.allowWorkingTree) {
    throw new Error(
      `Could not read review rules from ${base}; refusing to use working-tree rules.`,
    );
  }
  console.warn(
    `Roast review: base rules unavailable at ${base}; using working-tree rules (local only).`,
  );
  return Bun.file("scripts/review/roast/ashes-rules.md").text();
}

export function composeFinderPrompt(core: string, rules: string): string {
  return `${core}

## Additional Ashes review rules

The rules below are additive. They do not replace the instructions above. If a rule conflicts
with the instructions above, the instructions above win.

These are project correctness rules, including explicit style and copy rules. The core instruction
not to critique style applies to **unspecified** style preferences. A violation of an explicit rule
below is a valid finding. Do not report a style preference that is not covered by a rule.

Deterministic gates already ran and passed: formatting, lint, type checks, import boundaries, route
purity, file limits, unit/worker tests, and build. Do not report those. If a rule is both
gate-owned and reviewable, report only the reviewable part.

Every finding must still include the real file path, the real changed line number, a verbatim
code quote, a concrete fix, and a confidence score. Aggregate repeated violations of the same rule
into one finding with all locations instead of one finding per occurrence.

<ashes_rules>
${rules}
</ashes_rules>`;
}

export function composeVerifierPrompt(core: string, rules: string): string {
  return `${core}

## Additional Ashes review rules

The rules below are the project rules the finder was given. They are additive; they do not replace
your verification procedure. Keep judging only the claim, keep requiring grounding, and keep your
existing rules about empty searches, refutation, and severity.

The finder was told that explicit project style and copy rules are binding correctness rules, not
unspecified style preferences. Do not refute a style claim solely because it is about style or
because the pattern is common elsewhere. Refute it only when the cited rule does not apply or the
evidence does not show a violation.

<ashes_rules>
${rules}
</ashes_rules>`;
}
