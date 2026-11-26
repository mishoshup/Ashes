---
name: context
description: Load first for any Ashes task. Product invariants, locked stack decisions, repo map, and where each rule lives.
---

# Ashes context

## Product truth

Ashes is a community-first platform: chats, channels, publishing, discovery, club, profile.
**The community is the homepage.** There is no algorithmic feed, no global timeline, no
"For You" surface. Content is always scoped by community and channel; public/private is
enforced at the API boundary.

Chat and publishing are different primitives:

- Chat: realtime, casual, messages disappear into history.
- Posts/articles: persistent, structured, searchable, discoverable inside public channels.
- Private channels stay private.

## Locked stack

| Area | Decision |
|---|---|
| Server state | TanStack Query v5 + persisted outbox; no Onyx |
| Local UI | Zustand only (session, tab, modals, drafts, network) |
| Router | Expo Router + responsive tablet/web shell |
| API | Cloudflare Workers + Hono + Zod |
| DB | Cloudflare D1 + Drizzle ORM + Wrangler migrations |
| Forms | react-hook-form + Zod + `FormField` adapter |
| Lint/format | oxlint type-aware + oxfmt |
| Tests | Vitest Workers pool, Bun (pure), RNTL/Jest, Playwright |
| CI | GitHub Actions + Wrangler + local EAS |

## Repo map

- `apps/api` — Hono, routes, services, Drizzle schema/migrations, tests.
- `apps/mobile` — Expo app; `src/app` is routes only; feature code outside it.
- `packages/contracts` — Zod schemas and inferred types, no runtime side effects.
- `packages/core` — pure utilities, no React/Node/DB.
- `scripts` — verify, arch, review, seed, e2e.
- `.agent/skills` — canonical skills. `.claude`, `.agents`, `.opencode` are symlinks.

## Where to look

- Decisions and commands: `AGENTS.md`.
- State/mutations/realtime: `state-and-data`.
- Routes/tablet/web: `routing`.
- Hono/Zod/Drizzle: `api-and-contracts`.
- Tests: `testing`.
- Auth/PII/uploads: `security-privacy`.
- CI/EAS: `ci-release`.
- Review loop: `review-loop`.

## Non-negotiables

1. Actions only; components never fetch or mutate a cache directly.
2. Zod at every boundary.
3. No raw SQL in routes; repository layer only.
4. Tokens in SecureStore only.
5. No feed, no ranking, no engagement optimization.
6. No design docs, no PLAN.md/TODO.md. Code, tests, and these skills are the documentation.
7. No `any`, no `@ts-ignore`, no non-null assertions.
8. No file over 300 lines (generated/data/seed exempt).
9. Every bug fix has a regression test; every route/mutation has an integration test.
10. Agents never push or merge. A human ships.

## Commands

`bun run dev`, `verify`, `format`, `lint`, `typecheck`, `arch`, `test`, `test:mobile`,
`e2e`, `build`, `review`, `db:generate`, `db:migrate`, `db:seed`.

If a command is missing, create the script; never invent a parallel workflow.

## First move on any task

1. Read `AGENTS.md` and this file.
2. Load the task-specific skill.
3. Find the existing pattern; do not create a new one.
4. Check the current gate output (`bun run verify` if it exists).
5. Plan in three lines, then edit.
