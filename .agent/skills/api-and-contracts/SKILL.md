---
name: api-and-contracts
description: Cloudflare Workers + Hono + D1/Drizzle + Durable Objects + R2 + magic-link auth. Fine-grained API rules for Ashes.
---

# API and contracts

**Runtime: Cloudflare Workers. No Bun server, no Node APIs, no native modules.**

## Worker shape

```text
apps/api/
  wrangler.jsonc        # D1, R2, DO, Queues, Cron, vars
  drizzle.config.ts     # sqlite dialect, schema -> migrations
  migrations/           # SQL applied by wrangler d1 migrations
  src/
    index.ts            # export default Worker; export Durable Object
    app.ts              # createApp(): Hono<{Bindings: Env}>
    types.ts            # Env bindings
    middleware/         # request id, security, cors, auth, rate limit, body limit
    routes/             # auth, me, home, communities, channels, posts, chats, discover, club, uploads, ws
    services/           # authorization, transactions, domain rules
    db/schema.ts        # Drizzle tables
    db/repositories/    # D1 queries only
    durable/room.ts     # per-room WebSocket/presence DO
  test/                 # Vitest Workers pool
```

API-1: `createApp()` reads `c.env`; no module-level DB/network state.
API-2: Middleware order: request ID → security headers → CORS → auth → rate limit → body limit.
API-3: Routes validate params/query/body with Zod; services own authz and transactions.
API-4: No SQL in routes. Repositories are the only place touching Drizzle/raw SQL.
API-5: Every mutation accepts `Idempotency-Key`; replay returns the stored response.
API-6: Errors: `{error:{code,message,requestId}}`; private resources return 404.
API-7: Authz before writes; never trust a client permission flag.
API-8: D1 multi-statement writes use `db.batch()`; cross-request coordination uses a Durable Object.
API-9: Uploads go to R2; validate bytes/size; random keys; no SVG/GIF; client compresses before upload.
API-10: Every route has a Vitest Workers test with Miniflare D1/R2/DO.

## Auth (magic link)

- `POST /api/auth/magic-link` with email + Turnstile token.
- Rate limit by IP + email; always return 200 to avoid account enumeration.
- Generate a 32-byte token, store only SHA-256 hash in D1 `login_tokens` with 10-minute expiry.
- Send link via transactional email (Resend/MailChannels). In local dev, return the link only when `ENVIRONMENT=development`.
- `POST /api/auth/verify` consumes the token atomically, creates the user if new, creates a session token (32 bytes, SHA-256 hash in D1, 30-day expiry), returns the raw token once.
- `POST /api/auth/logout` revokes the current session; `POST /api/auth/logout-all` revokes all.
- Bearer token only. Never put tokens in URLs, logs, query cache, or AsyncStorage.
- Optional password step-up: set a password only from a verified magic-link session. Use Argon2id via `@phi-ag/argon2` WASM SIMD (m=19456 KiB, t=2, p=1) with a required 32+ character HMAC pepper; store a PHC string; require the current password to change it; revoke other sessions.

## D1 + Drizzle

- Schema is `src/db/schema.ts`; migrations are generated SQL in `migrations/`.
- `bun run db:generate` → `drizzle-kit generate`.
- `bun run db:migrate:local` → `wrangler d1 migrations apply ashes-db --local`.
- `bun run db:migrate:remote` → `wrangler d1 migrations apply ashes-db --remote`.
- Every migration tested from empty and from the previous version.
- No destructive migration without backup/rollback note.
- D1 quirks: no long-lived interactive transactions; use `batch()` or a DO. Verify FTS5/feature support before relying on it.
- Indexes: feed cursors, message room+created, membership lookups, idempotency expiry.
- IDs: prefixed ULIDs; timestamps: ISO UTC.
- Tombstones (`deleted_at`) for entities the client cache must represent.

## Durable Objects

- One DO per channel/chat room (`ROOM` binding); `idFromName(roomId)`.
- WebSocket hibernation (`ctx.acceptWebSocket`), `ctx.getWebSockets()` broadcast.
- Store presence/typing ephemeral state in DO memory or DO storage; never in a Worker isolate.
- Sequence messages per room if clients need gap detection; persist last sequence in DO storage.
- Close unauthorized sockets; auth is checked before forwarding the upgrade.
- DO alarms for idle cleanup; no `setInterval` in a Worker.

## R2 uploads

- Worker endpoint accepts multipart; client compresses to WebP/JPEG via `expo-image-manipulator`.
- Max 8 MB; dimensions cap; sniff bytes, not `Content-Type`.
- Random key `uploads/<userId>/<ulid>.<ext>`; no user filename.
- Store metadata in D1 (`attachments`), bytes in R2.
- Serve via a Worker route or signed URL; set `Content-Type`, `nosniff`, immutable cache.
- Cloudflare Images for transforms (paid) or accept compressed originals for MVP.

## Queues/Cron

- `JOBS` producer for push, email, moderation, image post-processing.
- Queue consumer is idempotent; retries are expected.
- Cron for daily streaks/badges/digests; no long loops; chunk work.

## Tests

- `@cloudflare/vitest-pool-workers` + `cloudflare:test` `SELF.fetch`.
- Miniflare bindings for D1/R2/DO; apply migrations in test setup.
- Auth: magic token single-use, expiry, session revocation, enumeration-safe responses.
- Access: private community/channel, non-member write, hidden resource.
- Writes: idempotency replay, D1 batch atomicity, optimistic conflict.
- Upload: valid image, oversize, wrong MIME, traversal key.
- Realtime: unauthorized close, broadcast, reconnect sequence.
