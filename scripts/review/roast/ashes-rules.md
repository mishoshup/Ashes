# Ashes reviewable rules

Deterministic gates already run before this review:

- `oxfmt`, `oxlint`, `tsc`, architecture/import checks, file limits, unit/worker tests, build.
- Formatting, lint, type errors, import boundaries, route purity, file length, `any`, `@ts-ignore`,
  and non-null assertions are gate-owned. Do not report them.

Only the rules below need a reviewer. A finding must cite one rule ID and exact evidence.

## Product invariants

- **PRODUCT-1** No global feed, ranking, "For You", trending, or popularity metric. Content is
  scoped by community/channel.
- **PRODUCT-2** No shame. A slip is not a failure. Never use "failure", "cheated", "gave up",
  "dirty", or a red failure screen for a slip or return.
- **PRODUCT-3** Private by default. A reflection, check-in, or quit attempt is never public or
  shared without an explicit, previewed action.
- **PRODUCT-4** No forced disclosure. Do not imply that a user must post, share progress, or
  reveal smoking status to participate.
- **PRODUCT-5** Insights are observations or opinions, not instructions or diagnosis. Do not say
  "you should", "try this", "the fix", or assign a clinical label.
- **PRODUCT-6** Recognition is for insight, kindness, and contribution, never quit duration,
  streak length, posting volume, or popularity.
- **PRODUCT-7** One primary action per screen. Do not present three equally prominent CTAs.
- **PRODUCT-8** No events. Badges only.

## State and data

- **STATE-1** Components call `features/<domain>/actions.ts`. They do not call `fetch`,
  `queryClient.setQueryData`, or a database client.
- **STATE-2** TanStack Query owns server state. Zustand holds only local UI/session state, never
  server entities.
- **STATE-3** A write has an optimistic patch, rollback on error, and a persisted outbox when it
  can run offline.
- **STATE-4** Realtime frames patch and dedupe the cache. Reconnect fetches after the last known
  message ID.
- **STATE-5** `useEffect` is only for external synchronization with cleanup. It is not for derived
  state, event reactions, parent notification, prop resets, or data fetching.

## API and security

- **API-1** Parse every route param, query, body, env value, upload, and API response with Zod.
- **API-2** Check authorization before a mutation. Private resources return 404, not 403.
- **API-3** Every write accepts an `Idempotency-Key` and replays the stored response. A duplicate
  must not double-write.
- **API-4** SQL lives in a service/repository. Routes do not contain raw SQL. Multi-statement
  atomic changes use `D1.batch()`.
- **API-5** Tokens never appear in a URL, log, analytics event, query cache, or error report.
  WebSocket auth uses a short-lived ticket, not the session token.
- **API-6** Writes have a body cap and a rate limit. Errors use the one error envelope.
- **API-7** Public preview is read-only. Writes require a session; the client shows a nudge, not a
  redirect or a wall.

## Routing

- **ROUTE-1** Use the typed route registry. No raw route strings in screens.
- **ROUTE-2** Validate every route param with Zod. Invalid params render not-found; never crash.
- **ROUTE-3** Guards live in layouts. No scattered `router.replace` in screens.

## Style, copy, and consistency

These are binding project rules, not personal preferences. Report a style finding only when it
cites a rule and the evidence makes the violation unambiguous. Aggregate repeated violations.

- **STYLE-1** Use the palette and design tokens. No inline hex colors, spacing, or radii where a
  token exists.
- **STYLE-2** Reuse the shared primitives (`Page`, `Button`, `CtaLink`, `TopicCard`,
  `CommunityCard`) before writing a new component.
- **STYLE-3** Sentence case for headings, labels, and buttons. No exclamation marks. No assistant
  or tooling jargon ("as an AI", "let's dive in", "leverage", "seamless").
- **STYLE-4** Comments state why, not what. No `TODO`, `FIXME`, `HACK`, or `XXX` markers. Plain
  prose, no emoji.
- **STYLE-5** Event handlers are named `onX`. Booleans start with `is`, `has`, `should`, or `can`.
  Functions start with a verb. No single-letter identifiers except loop indices and `id`.
- **STYLE-6** One concept per file. If a component or service does two jobs, split it.
- **COPY-1** No shame or blame in slip, reset, return, or missed-day copy. Use "slip", "restart",
  "keep moving", "welcome back".
- **COPY-2** No diagnosis or clinical labels. Say "you may have noticed", not "you have anxiety".
- **COPY-3** No imperative advice in psychology content. Insights are opinions, not a program.
- **COPY-4** No public progress pressure. Milestones are quiet and optional.
- **COPY-5** Correct plurals, consistent pronouns, and consistent product nouns: "community",
  "channel", "reflection", "check-in", "slip", "restart".

## Severity for project rules

- **Critical**: auth bypass, secret/PII leak, data loss, destructive migration, broken access
  control.
- **High**: private content leak, shame/blame in a slip or return flow, public-by-default
  reflection, duplicate write/idempotency bug, broken guard.
- **Medium**: missing test for changed behavior, effect misuse, style/design-system break that
  harms comprehension or theming, diagnosis or advice copy.
- **Low**: naming, comments, copy consistency, minor style.

Do not raise a finding's severity to make it block. Report the actual impact.
