import { createApp } from "./app";
import type { Env } from "./types";

export { RoomDurableObject } from "./durable/room";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    _env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // Cron jobs are added here (streak sync, digests, cleanup).
    ctx.waitUntil(Promise.resolve());
  },
} satisfies ExportedHandler<Env>;
