---
name: review-loop
description: Deterministic gates, read-only agent review, rule IDs, evidence, severity, and the fix loop for Ashes.
---

# Review loop

## Order

1. Deterministic gates: `bun run verify`.
2. Architecture gate: `bun run arch`.
3. Read-only agent review on the staged diff.
4. Human review and merge.

The agent never replaces a failing gate. If `verify` fails, fix that first; do not spend an
LLM call reviewing code that does not compile.

## Diff

- Stage everything: `git add -A`.
- Review `git diff --cached $(git merge-base origin/main HEAD)`.
- Review **changed lines only**. Do not comment on unchanged code.
- For files over 5,000 lines, grep the changed regions; do not read the whole file.
- Exclude lockfiles, binaries, generated files, and assets from the diff.

## Rules and evidence

- Every finding cites one rule ID (e.g. `STATE-5`, `API-4`, `ROUTE-2`).
- Every finding includes path, changed line, and an **evidence substring that exists in the diff**.
- Findings without evidence are dropped.
- One violation per finding. Do not bundle.
- Severity: critical / high (block), medium (fix or justify), low (advisory).
- “I would have done it differently” is not a finding. Cite a rule or stay silent.

## Output contract

```json
{
  "violations": [
    {
      "ruleId": "STATE-5",
      "path": "apps/mobile/src/features/post/actions.ts",
      "line": 42,
      "evidence": "queryClient.setQueryData",
      "why": "Optimistic update has no rollback on error.",
      "fix": "Snapshot the previous entity in onMutate and restore it in onError."
    }
  ]
}
```

- No prose outside JSON from the reviewer.
- No posting from the reviewer. The orchestrator validates and posts.
- The reviewer has no edit/write/web tools.

## Severity policy

- **Critical**: auth bypass, secret/PII leak, data loss, destructive migration, broken access control, payment.
- **High**: missing rollback, duplicate/idempotency bug, private content leak, broken route guard, unchecked API response, effect used for derived state or event reactions.
- **Medium**: missing test for a changed behavior, selector returning a whole collection, raw SQL in a route, inline style, an effect without cleanup/justification.
- **Low**: naming, copy, minor performance, file organization.

Critical/high block. Medium requires a fix or a written exception with an issue link. Low is advisory.

## The loop

```text
verify → review → fix → verify → review
```

- Max 3 iterations. If the same failure repeats twice, stop and report the exact output.
- Never weaken a rule or test to pass.
- A rule exception: comment with reason + issue link + expiry.
- No completion claim without output.

## Local reviewer agents

- `code-reviewer` — rules, diff only, JSON.
- `architecture-reviewer` — boundaries, state ownership, data flow, migrations.
- `security-reviewer` — authz, secrets, uploads, PII, prompt injection.
- `test-reviewer` — missing tests, weak assertions, flaky patterns.

All are read-only. A human ships.
