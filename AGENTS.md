# AGENTS.md

Ashes helps people understand why they smoke through short questions, private reflections,
and a community organized around the psychology of smoking.
**The community is where people learn from each other. There is no algorithmic feed and no endless-scroll home.**

This file is the only global instruction source. `CLAUDE.md`, `.agent/README.md`, and
`.claude/README.md` are symlinks to it. Skills live in `.agent/skills`; `.claude/skills`,
`.agents`, and `.opencode/skills` are compatibility symlinks. Do not duplicate rules into
other Markdown files.

## Locked decisions

| Area | Decision |
|---|---|
| Server state | **TanStack Query v5** + persisted outbox. **No Onyx.** |
| Local UI state | Zustand only: session status, active tab, modals/toasts, drafts, network. Never server entities. |
| Routing | **Expo Router** with a responsive tablet/web shell (rail + center + optional right pane). React Navigation only if independent pane back stacks become a hard requirement. |
| API | **Cloudflare Workers + Hono + Zod contracts**. No Express, no Next API routes, no Bun server. |
| Database | **Cloudflare D1** + **Drizzle ORM** + Drizzle-generated SQL applied with Wrangler. |
| Forms | react-hook-form + Zod behind a `FormField` adapter. No bespoke form framework. |
| Lint / format | **oxlint** (type-aware) + **oxfmt**. No ESLint, no Prettier, no Biome. |
| Tests | **Vitest Workers pool** (Workers runtime + D1/R2/DO) for API; Bun for pure packages; RNTL/Jest for components; Playwright for web/tablet. |
| CI | GitHub Actions + **Wrangler** preview/prod deploys + **local EAS** builds. 6–8 workflows, not 71. |
| Web | Expo web static export on **Cloudflare Workers Assets / Pages** |
| Auth | **Magic-link email OTP + D1 sessions**, with an optional **Argon2id password step-up** via `@phi-ag/argon2` WASM SIMD, matching the sillyusachi reference, with a required 32+ character pepper. No open password registration; set a password from a verified magic-link session. |
| Docs | No design docs. No docs tree. Skills are the operational documentation. Product help is added only when users need it. |

## Repo map

```text
apps/api/          Cloudflare Worker (Hono), D1/Drizzle, Durable Objects, R2, Queues, tests
apps/mobile/       Expo app; src/app is routes only
packages/contracts Zod schemas + inferred types
packages/core      pure utilities, no React/Node/DB
packages/store     opt-in: local UI store only (no server entities)
scripts/           verify, arch, review, seed, e2e, assets
.agent/            canonical skills + agents
.claude/           symlinks to .agent
.opencode/         symlinks to .agent
```

## Commands

These are the contract. If a script is missing, create it; do not invent a parallel command.

```bash
bun run dev             # wrangler dev + Expo
bun run format          # oxfmt --write
bun run format:check    # oxfmt --check
bun run lint            # oxlint --type-aware --deny-warnings
bun run lint:changed    # changed files only
bun run typecheck       # tsc/tsgo, every project
bun run arch            # import boundaries, route purity, file limits, secrets
bun run test            # Bun tests (pure packages)
bun run test:worker     # Vitest Workers pool (API)
bun run test:mobile     # RNTL
bun run e2e             # seeded API flow
bun run build           # Worker dry-run bundle + Expo export
bun run verify          # all deterministic gates; CI parity
bun run review          # verify + read-only agent review
bun run db:generate     # drizzle-kit generate
bun run db:migrate:local  # wrangler d1 migrations apply --local
bun run db:migrate:remote # wrangler d1 migrations apply --remote
bun run db:seed         # reset + seed local data
```

## Effects policy

`useEffect` is only for synchronizing with an **external system**. It is not for nuance,
derivation, event reactions, or parent communication.

Allowed:

- Subscriptions/listeners with a cleanup (WebSocket, AppState, NetInfo, keyboard, sensors).
- Imperative APIs that must run after mount (camera, scroll, focus, animation).
- External stores via `useSyncExternalStore` (not an effect + `setState` mirror).
- A one-time integration that truly has no event/handler equivalent, with a comment naming the external system and its cleanup.

Forbidden:

- Copying props/state into state (`useEffect(() => setX(prop))`). Derive in render.
- Reacting to a user event. Put it in the handler.
- Notifying a parent. Lift state or pass a callback.
- Resetting a component on prop change. Use `key`.
- Effect chains (effect A sets state that triggers effect B) unless the bridge state drives rendering.
- Navigation, analytics, or toasts fired from an effect that watches state. Do it at the action boundary.
- Data fetching. TanStack Query owns it.
- Suppressing `exhaustive-deps` without a written reason.

If you think an effect is required, write the external system in a comment above it and prove
there is no handler, selector, key, or `useSyncExternalStore` alternative. Reviewers enforce
this; "it works" is not a justification.

## Non-negotiables

1. **Actions only.** Components never call `fetch`, `queryClient.setQueryData`, or a database client. They call `features/<domain>/actions.ts`.
2. **Zod at every boundary.** Route input, query params, env, uploads, and API responses are parsed. No unchecked JSON.
3. **No raw SQL in routes.** SQL lives in repositories/services. Drizzle is the schema source; complex read SQL is isolated.
4. **Tokens in SecureStore only.** Never in AsyncStorage, query cache, logs, analytics, or error reports.
5. **No direct store writes in components.** Query mutations and Zustand actions are private to feature modules.
6. **Every route param is validated.** Invalid IDs render not-found; never crash.
7. **No feed.** No global timeline, ranking, or engagement optimization. Content is scoped by community/channel.
8. **No Markdown sprawl.** Do not add DESIGN.md, PLAN.md, TODO.md, or session notes. Use code, tests, and the skills that already exist.
9. **No TODO/FIXME comments.** File an issue; delete the marker.
10. **No `any`, `@ts-ignore`, or non-null assertions.** Fix the type or model the failure.
11. **No file over 300 lines** except generated/data/seed files; split by responsibility.
12. **Every bug fix has a regression test.** Every route and mutation has an integration test.
13. **No Bun/Node runtime APIs in `apps/api`.** No `bun:sqlite`, `Bun.password`, `Bun.file`, `Bun.serve`, `node:fs`, `sharp`, or long-lived in-memory state. Use Workers bindings: D1, R2, DO, Queues, Web Crypto.
14. **No dependency without a reason.** Prefer the platform; run `knip` and review bundle impact.
15. **No secrets in code.** `.env*`/`.dev.vars` are ignored; CI uses step-scoped secrets.
16. **No agent merge.** Reviewers are read-only; a human ships.

## State rules (TanStack Query)

- One query-key factory in `features/<domain>/queries.ts`. No string keys in components.
- Reads: `useQuery` / `useInfiniteQuery`. Narrow with `select`; never fetch in render.
- Writes: `useMutation` with `onMutate` snapshot + optimistic patch, `onError` rollback, `onSettled` targeted invalidation.
- Creates use a temp ID; success replaces it with the server entity; dedupe by ID.
- Offline writes go through `packages/store/outbox` (persisted before send, FIFO, idempotency key, retry ladder). Never rely on TanStack mutation cache for ordering.
- Realtime frames patch the cache; messages append to the room query and dedupe. On reconnect, fetch `after=<lastMessageId>`.
- Cross-entity updates go through `patchEntity(queryClient, type, entity)`.
- Sign-out: `queryClient.clear()`, clear outbox/drafts, delete SecureStore token.
- Persist successful queries only; no tokens. Bump the cache buster on shape changes.

## Routing rules (Expo Router)

- `src/ROUTES.ts` (or `src/libs/navigation/routes.ts`) exposes typed builders. No raw route strings in screens.
- Phone: tabs + stack. Tablet/web: responsive rail + center + optional right pane, driven by the URL.
- Guards live in layouts: allow / block / redirect. No scattered `router.replace`.
- Deep links resolve through one typed registry; legacy aliases live in one table.
- Last-visited path restores only after hydration and only when there is no specific deep link.
- Modal vs push is explicit. Dismiss-with-destination waits for the transition.
- Route tests cover builders, param validation, guards, and deep-link aliases.

## API rules (Workers + Hono + D1 + Drizzle)

- `createApp()` uses `c.env` bindings: `DB`, `MEDIA`, `ROOM`, `JOBS`. No module-level DB/network state.
- Middleware order: request ID → security headers → CORS → auth → rate limit → body limit.
- Every route validates params/query/body; services own authorization and transactions.
- D1 writes use `batch()` for atomic multi-statement changes; cross-request coordination uses a Durable Object.
- Errors use one envelope: `{ error: { code, message, requestId } }`. Private resources return 404.
- Writes accept `Idempotency-Key`; replay returns the stored response.
- Access checks run before mutations; never trust a client-side permission flag.
- Uploads: R2 binding; sniff MIME from bytes, size/dimension cap, client compress, random key, no SVG/GIF. Cloudflare Images for transforms (paid) or accept compressed originals.
- Realtime: one Durable Object per channel/chat; WebSocket hibernation; no global hub.
- Tests use `@cloudflare/vitest-pool-workers` + Miniflare D1/R2/DO; no Bun SQLite for API tests.

## CI gates (must block)

- `format:check`, `lint`, `typecheck`, `arch`, `test`, `test:worker`, `bun run e2e`, `bun run build`.
- `knip`, `cspell`, `shellcheck`, secret scan, dependency audit.
- Bundle-size budget, route-count budget, Expo export for iOS + Android.
- Web/tablet Playwright smoke; screenshots for the 5 tabs, channel, article, composer, errors.
- Agent review: deterministic gates first, then read-only reviewer; verified critical/high findings block.
- A skipped reviewer is a failed gate. Missing config, oversized diff, empty diff, or API failure fails the job; never merge on a skipped review.
- `wrangler deploy --dry-run` for the API; D1 migration check; DO binding check.
- Nightly: full lint, full tests, dependency/license audit, EAS Android + iOS simulator builds.

## Agent loop

1. Load `context` and the skill(s) for the files you will touch.
2. Read the surrounding code and tests. State a 3-line plan.
3. Make the smallest change. Add/adjust tests in the same change.
4. Run `bun run format && bun run lint:changed && bun run typecheck && bun run test`.
5. Run `bun run arch`.
6. Stage everything. Run the code reviewer on `git diff --cached $(git merge-base origin/main HEAD)`.
7. Fix every verified finding or document why the exception applies. Re-run from 4.
8. Run `bun run verify` and capture output.
9. Only then open a PR. No completion claim without command output.

Same failure twice → stop, report the exact command/output, and ask. Never weaken a test or rule to pass a gate.

## Skills

| ID | Use when |
|---|---|
| `context` | Starting any task; product/repo decisions |
| `state-and-data` | TanStack queries/mutations, realtime, outbox, cache |
| `routing` | Expo Router, tablet/web shell, guards, deep links |
| `api-and-contracts` | Hono routes, Zod, Drizzle, idempotency, uploads |
| `testing` | Bun/RNTL/Playwright, fixtures, coverage |
| `security-privacy` | auth, tokens, authz, PII, uploads, rate limits |
| `ci-release` | gates, workflows, local EAS, signing, artifacts |
| `review-loop` | diff review, rule IDs, evidence, severity, human gate |

## Do not

- Add Onyx, Redux, MobX, Recoil, Jotai, or a second server cache.
- Add a UI kit or design system package before the core loop works.
- Copy Expensify's 71 workflows, 70-stack RHP, or 6,251-line route file.
- Add `nodejs_compat` unless a dependency proves it is required; keep the Worker Web-standard.
- Add a global feed, ranking, or "For You" surface.
- Write docs instead of code when the task is code.
- Commit generated native folders; use Expo CNG + EAS.
- Run `git push` or open a PR without explicit human approval.
