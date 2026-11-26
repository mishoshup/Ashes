---
name: review-loop
description: Roast review, additive project rules, deterministic gates, evidence, severity, and the fix loop for Ashes.
---

# Review loop

## Order

1. Deterministic gates: `bun run verify`.
2. Architecture gate: `bun run arch`.
3. Roast review: `bun scripts/roast-review.ts` (or `bun run review`).
4. Human review and merge.

If `verify` fails, fix that first; do not spend an LLM call reviewing code that does not compile.

## Roast

- Pinned version: `v1.5.1`. Install with `bun run review:install` (or `go install github.com/bluesky-social/roast/cmd/roast@v1.5.1`).
- Finder and verifier both use `deepseek/deepseek-v4.1-flash`.
- The finder core and verifier core are fetched from the pinned Roast tag and hash-checked.
- Project rules are **additive**, not a replacement: `scripts/review/roast/ashes-rules.md`.
- Rules are read from the base commit, so a PR cannot weaken the rules that review it.
- The verifier keeps Roast's default procedure: judge only the claim, require grounding, never raise severity.
- MEDIUM and above fail the review. LOW is advisory.

## Rules and evidence

- Every finding cites a rule ID from `ashes-rules.md` and exact code evidence.
- Roast requires a verbatim `code_quote` and a concrete `fixed_code`; findings without both are dropped.
- Deterministic gates already cover formatting, lint, types, imports, route purity, file limits, and build. Do not report those.
- Style and copy are binding rules, not taste. Report only a rule-backed style violation; aggregate repeated occurrences.
- “I would have done it differently” is not a finding.

## Severity policy

- **Critical**: auth bypass, secret/PII leak, data loss, destructive migration, broken access control.
- **High**: private content leak, shame/blame in a slip or return flow, public-by-default reflection, duplicate write/idempotency bug, broken guard.
- **Medium**: missing test for changed behavior, effect misuse, style/design-system break that harms comprehension or theming, diagnosis or advice copy.
- **Low**: naming, comments, copy consistency, minor style.

Critical/high/medium block. Low is advisory. Never raise severity to force a block.

## Diff

- Stage everything: `git add -A`.
- Local review reads the branch diff against `origin/main`.
- CI review checks out the base commit and Roast fetches the PR head into a temporary worktree. It reads code; it never executes PR code.
- Review changed lines only. Roast handles diff windows and excludes.

## Output

- CI posts one marker-controlled PR comment (`<!-- ashes-roast-review -->`).
- Local prints the report.
- A missing key, missing Go binary, failed prompt hash, failed model call, or failed comment post fails loudly. A skipped review is never a pass.
- A human approves pushes and merges.

## The loop

```text
verify → roast → fix → verify → roast
```

- Max 3 iterations. If the same failure repeats twice, stop and report the exact output.
- Never weaken a rule or test to pass.
- No completion claim without output.
