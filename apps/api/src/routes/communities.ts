import { communitiesResponseSchema } from "@ashes/contracts";
import { Hono } from "hono";
import { listPublicCommunities } from "../services/communities";
import type { AppEnv } from "../types";

export const communityRoutes = new Hono<AppEnv>();

communityRoutes.get("/", async (c) => {
  return c.json(communitiesResponseSchema.parse({ items: await listPublicCommunities(c.env) }));
});
