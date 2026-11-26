---
name: testing
description: Vitest Workers pool, Miniflare D1/R2/DO, Bun pure tests, RNTL/Jest, Playwright, fixtures, and Given/When/Then.
---

# Testing

## Pyramid

1. **Pure unit** — `packages/core`, query keys, route builders: Bun.
2. **Contract** — Zod round-trips, invalid payloads: Bun.
3. **Worker integration** — Vitest Workers pool + Miniflare D1/R2/DO + `SELF.fetch`.
4. **Store/offline** — optimistic rollback, outbox persist/replay, realtime patch: Bun.
5. **Component** — RNTL/Jest for forms, lists, error/empty states.
6. **E2E** — Playwright for web/tablet; one real flow against a seeded API.
7. **Native smoke** — Maestro or manual simulator checklist after the core loop.

## Rules

- TEST-1: Every bug fix has a regression test that fails before the fix.
- TEST-2: Every Worker route has a Vitest test; every mutation has optimistic/rollback coverage.
- TEST-3: Document each test with `// Given`, `// When`, `// Then`, explaining why.
- TEST-4: Fresh QueryClient per test; retries off; no shared cache.
- TEST-5: No real network in unit/integration tests. Mock at the HTTP boundary or use Workers bindings.
- TEST-6: Fixtures are builders, not giant JSON blobs. One factory per entity.
- TEST-7: Assert observable behavior (status, cache, store), not implementation details.
- TEST-8: No snapshot tests for large trees. Screenshots are visual regression only.
- TEST-9: Clean up timers, subscriptions, and DBs; order-independent.
- TEST-10: Coverage gates apply to changed lines and critical modules.

## Worker tests

```ts
import {SELF} from "cloudflare:test";
import {describe, it, expect} from "vitest";

it("returns health", async () => {
  const res = await SELF.fetch("https://example.com/healthz");
  expect(res.status).toBe(200);
});
```

- `vitest.config.ts` uses `defineWorkersConfig` with `wrangler.configPath`.
- `test/env.d.ts` augments `ProvidedEnv` with the Worker `Env`.
- Apply D1 migrations in a setup file; use Miniflare's isolated storage per test.
- Test DO WebSockets through `SELF.fetch` with an `Upgrade` header.
- Test R2 uploads through the real binding; do not mock R2 unless necessary.
- Run with `bun --cwd apps/api run test`.

## Commands

```bash
bun test                  # pure packages
bun run test:worker       # Vitest Workers pool
bun run test:mobile       # RNTL
bun run e2e               # seeded API + browser
bun run verify            # all gates
```

## Playwright

- Projects: phone 390×844, tablet 834×1112, desktop 1440×900.
- Test deep links directly, not only click paths.
- Assert no horizontal scroll, no clipped text, correct pane composition.
- Screenshot five tabs, channel, article, composer, empty/loading/error.

## Stop rule

Same test fails twice after a fix attempt → stop. Report command, output, hypothesis. Do not weaken the assertion.
