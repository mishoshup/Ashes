---
name: ci-release
description: Cloudflare Workers deploy, D1 migrations, Durable Object/R2/Queue setup, Wrangler previews, local EAS, budgets, and release checks.
---

# CI and release

## Workflows (6–8)

| Workflow | Trigger | Does |
|---|---|---|
| `verify` | PR/push | format, lint, typecheck, arch, unit, Workers tests, build, Expo export |
| `api-e2e` | PR | Vitest Workers pool + D1/R2/DO + seeded flow |
| `web-e2e` | PR/nightly | Playwright phone/tablet/desktop |
| `roast-review` | PR | pinned Roast v1.5.1, finder + verifier Flash, additive project rules, after deterministic gates |
| `deploy-preview` | PR (trusted) | `wrangler versions upload` + preview URL |
| `mobile-preview` | tags/manual | local EAS Android APK + iOS simulator `.app` |
| `deploy` | main/tag | D1 migrations + `wrangler deploy` + web assets |
| `nightly` | cron | full suite, audit, EAS, startup/INP, D1 backup |

No docs workflows unless product docs exist. No design docs.

## Cloudflare commands

```bash
bun --cwd apps/api run dev            # wrangler dev (local D1/R2/DO)
bun --cwd apps/api run deploy         # wrangler deploy
bun --cwd apps/api run db:generate    # drizzle-kit generate
bun --cwd apps/api run db:migrate:local
bun --cwd apps/api run db:migrate:remote
```

First-time setup (human, once):

```bash
wrangler d1 create ashes-db
wrangler r2 bucket create ashes-media
wrangler queues create ashes-jobs
wrangler secret put RESEND_API_KEY
wrangler secret put SESSION_PEPPER
wrangler secret put TURNSTILE_SECRET
```

Replace the D1 `database_id` placeholder in `wrangler.jsonc` with the created ID.

## Gates

- `format:check`, `lint` type-aware, `typecheck`, `arch`, `test`, `test:worker`.
- `wrangler deploy --dry-run` succeeds; D1 migrations apply from empty.
- `knip`, `cspell`, `shellcheck`, `gitleaks`, `bun audit`.
- Bundle-size budget, route-count budget, no duplicate deps.
- Playwright web/tablet smoke + screenshots.
- Roast review after deterministic gates; cannot override them.
- Nightly: full lint/tests, audit, EAS, perf, D1 backup/restore drill.

## Local EAS (unchanged)

- Local builds still require Expo auth (`eas login`/`EXPO_TOKEN`), one platform per build.
- No caching; `eas.json` node/fastlane/cocoapods/ndk/image fields ignored.
- Expo secret env vars unavailable locally; set in the environment.
- Android needs JDK 17 + SDK/NDK; iOS needs Xcode + fastlane + CocoaPods.
- iOS device/store builds need Apple signing; EAS Submit is remote.
- OTA is not local. Do not promise local OTA.
- Web is not EAS; it is an Expo static export to Cloudflare.

## Cloudflare security

- Previews under Cloudflare Access; production behind WAF/Bot Fight Mode.
- `pull_request_target` only with base checkout + Roast `--pr` reading the PR head in a temporary worktree; no PR code execution.
- Pin actions to SHAs; default `contents: read`; secrets step-scoped.
- Concurrency cancels superseded PR runs; cache Bun/Gradle/CocoaPods/Playwright.
- Upload logs/artifacts on failure.

## Release checklist

1. `bun run verify` green on the tag.
2. D1 migration tested from previous version; backup/export taken.
3. `wrangler deploy --dry-run` and production deploy succeed.
4. R2/Queues/DO bindings present; secrets set.
5. Android APK/AAB and iOS simulator/device artifacts built.
6. Version/build numbers synced.
7. Release notes: changes, migrations, known issues.
8. Rollback: previous Worker version + D1 restore plan.
9. Post-deploy smoke: auth, home, channel, post, chat, search, upload.
