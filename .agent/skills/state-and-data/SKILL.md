---
name: state-and-data
description: TanStack Query, optimistic mutations, persisted outbox, realtime patches, cache policy, and state tests for Ashes.
---

# State and data

**Server state is TanStack Query. Local UI is Zustand. Onyx is not used.**

## Query keys

One factory, no string literals in components:

```ts
export const qk = {
  me: ["me"] as const,
  home: ["home"] as const,
  community: (slug: string) => ["community", slug] as const,
  communityChannels: (id: string) => ["community", id, "channels"] as const,
  channel: (id: string) => ["channel", id] as const,
  channelPosts: (id: string, kind: string) => ["channel", id, "posts", kind] as const,
  channelMessages: (id: string) => ["channel", id, "messages"] as const,
  post: (id: string) => ["post", id] as const,
  postComments: (id: string) => ["post", id, "comments"] as const,
  chat: (id: string) => ["chat", id] as const,
  chatMessages: (id: string) => ["chat", id, "messages"] as const,
  profile: (handle: string) => ["profile", handle] as const,
  discover: (query: string) => ["discover", query] as const,
  club: ["club"] as const,
};
```

Rules:

- STATE-1: No query in a component. Queries live in `features/<domain>/queries.ts`.
- STATE-2: Use `select` to narrow; never return whole entities if a scalar suffices.
- STATE-3: Prefetch on intent (hover/focus web, post-transition native).
- STATE-4: Invalidate the narrowest prefix; prefer `setQueryData` after a mutation.

## Reads

- `useQuery(queryOptions)` for single entities; `useInfiniteQuery` for messages/posts.
- `staleTime` by domain: home 30s, channel 60s, posts 30s, profile 5m, discover 60s, chat 0.
- `gcTime` 5–30 min; persisted cache only for successful queries.
- No tokens, upload internals, or transient errors in the persisted cache.
- Sign-out: `queryClient.clear()`, clear outbox/drafts, delete SecureStore token.

## Mutations

```ts
useMutation({
  mutationFn: (input) => api.post(path, schema, input),
  onMutate: async (input) => {
    await queryClient.cancelQueries({queryKey});
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, optimistic);
    return {previous};
  },
  onError: (_e, _i, ctx) => ctx?.previous && queryClient.setQueryData(queryKey, ctx.previous),
  onSuccess: (data) => patchEntity(queryClient, "post", data),
});
```

Rules:

- STATE-5: Snapshot + rollback on every optimistic mutation.
- STATE-6: Creates use a temp ID; success replaces it; dedupe by ID.
- STATE-7: Never disable submit for validation; 1s leading-edge throttle; spinner on press.
- STATE-8: Cross-entity updates go through `patchEntity`; no screen-level cache surgery.

## Outbox (offline writes)

- Persist before send: AsyncStorage write completes before the network call.
- FIFO, one in-flight request; per-entity lanes only after measured contention.
- Every entry has `id`, `idempotencyKey`, method, path, body, `entityKey?`, attempts, optimistic/rollback patches.
- Error ladder: cancelled/duplicate/already-created (success), validation (drop + field errors), auth (pause + sign-in), network (jittered backoff, capped retries).
- On reconnect, resume outbox → invalidate affected queries. Do not replay the cache.
- Server enforces `(user_id, idempotency_key)` and replays the stored response.
- Sign-out clears the outbox.

## Realtime

- Frame: `{type, entity, data, seq, roomId?}`.
- Entity patches via `patchEntity`; messages append to the room infinite query, dedupe by ID, trim to budget.
- Reconnect: fetch messages `after=<lastMessageId>`; room cursor, not a global update log (add global `seq` only if multi-room consistency requires it).
- Ignore duplicate frames; if a room is open and the gap is unknown, invalidate + refetch that room.

## Zustand (local only)

- Session status, active tab, modal/toast, draft text, network status.
- No server entities. No duplicated source of truth.
- Persist drafts selectively; never persist tokens.

## Effects

- STATE-9: No effect for derived state. Compute during render or with `select`.
- STATE-10: No effect for user events, parent communication, or resets. Use handlers, lifted state, or `key`.
- Effects are allowed only for external synchronization: WebSocket/AppState/NetInfo subscriptions, imperative focus/scroll/camera, and one-time integrations with no event equivalent. Each has a cleanup and a comment naming the external system.
- Use `useSyncExternalStore` for external stores; never mirror a store into state with an effect.
- No effect chains unless the bridge state drives rendering. No data fetching in effects; TanStack owns it.
- No navigation/analytics/toasts from a state-watching effect; do it at the action boundary.
- If an effect is genuinely required, add a short comment: external system, why no handler/key/selector works, cleanup.

## Tests

- Query key builder uniqueness.
- Optimistic success/rollback for every mutation.
- Outbox: persist → reload → replay → idempotent; ordering; retry exhaustion.
- Realtime: patch applies, duplicate ignored, gap refetches.
- Sign-out clears cache/outbox/drafts/token.
- Use a fresh `QueryClient` per test with retries disabled.
