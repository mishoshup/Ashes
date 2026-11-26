---
name: routing
description: Expo Router, typed routes, guards, deep links, and the responsive tablet/web shell for Ashes.
---

# Routing

**Expo Router, URL-driven, tablet/web from day one.**

## Route tree

```text
src/app/
  _layout.tsx                 # providers, fonts, splash, error boundary
  (public)/welcome.tsx
  (public)/sign-in.tsx
  (public)/sign-up.tsx
  (app)/_layout.tsx           # auth + onboarding guard
  (app)/(tabs)/_layout.tsx    # channels | chats | discover | club | profile
  (app)/c/[community]/index.tsx
  (app)/c/[community]/ch/[channel].tsx
  (app)/p/[post].tsx
  (app)/dm/[chat].tsx
  (app)/u/[handle].tsx
  (app)/settings/index.tsx
  (app)/settings/profile.tsx
  compose.tsx                 # modal
  +not-found.tsx
```

Rules:

- ROUTE-1: `src/libs/navigation/routes.ts` is the only source of route strings. Screens call builders: `routes.channel(id)`.
- ROUTE-2: Validate every param with Zod in a route component or guard. Invalid → not-found.
- Routing-3: No navigation during render. Use handlers; defer from touch with a microtask. No navigation from a state-watching effect; navigate at the action boundary.
- Routing-4: Deduplicate same-route pushes; back must not create duplicate screens.

## Responsive shell

- Phone: bottom tabs, one pane, push detail.
- Tablet: persistent left rail (communities/channels) + center; optional right contextual pane.
- Web: same as tablet, with the URL as the source of truth for the selected community/channel/post.
- Breakpoints live in `src/styles/tokens.ts`; use `useWindowDimensions`, not `Platform.OS`.
- The shell is a layout route: `<Rail /><Slot />` on wide; `<Slot />` on narrow. Use `useSegments` to decide which pane is active.
- Right pane is URL-addressable (`/p/:id` under the current community) and dismissible; do not store selection only in component state.
- If independent per-pane back stacks become a hard requirement, stop and evaluate React Navigation split navigators. Do not build a custom router speculatively.

## Guards

- `(app)/_layout.tsx` checks session hydration and onboarding completion; redirect to public/auth or onboarding.
- Guard result is allow / block / redirect. A blocked back action must re-sync browser history.
- Never render a screen that requires a session before hydration completes; show a boot shell.
- Public routes redirect authenticated users to Channels.

## Deep links

- Scheme: `ashes://`; web: `https://ashes.club/...`.
- One resolver maps URL → typed route; invalid IDs → not-found.
- Legacy aliases live in one table; do not scatter redirects.
- Last-visited path restores only after hydration and only when no specific deep link exists.

## Tablet/web tests

- Playwright at phone, tablet, and desktop widths.
- Verify list/detail selection, URL restoration, back behavior, and no duplicate pushes.
- Screenshot the five tabs, channel, article, composer, empty, loading, and error states.
- No horizontal clipping at 320 px or 1024 px.

## Anti-patterns

- Raw href strings in screens.
- `router.push` inside render or a Zustand selector.
- A modal for a task that needs neither interruption nor protected focus.
- Hiding a broken route behind a redirect instead of fixing params.
- Assuming `width > breakpoint` means "wide enough for three panes"; test the actual composition.
