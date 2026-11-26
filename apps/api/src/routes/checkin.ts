import {
  checkInInputSchema,
  checkInPromptSchema,
  checkInResponseSchema,
  patternsResponseSchema,
  promptIdSchema,
  psychTopicSchema,
} from "@ashes/contracts";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { checkRateLimit } from "../lib/rate-limit";
import { requireAuth } from "../middleware/auth";
import {
  answerIsValid,
  checkInPrompt,
  listPatterns,
  publicTopic,
  recordCheckIn,
  topicBySlug,
} from "../services/checkin";
import type { AppEnv } from "../types";

export const checkInRoutes = new Hono<AppEnv>();

checkInRoutes.get("/", requireAuth, (c) => {
  const raw = c.req.query("kind");
  const parsed = promptIdSchema.safeParse(raw ?? "trigger");
  if (!parsed.success) {
    throw new HTTPException(400, { message: "Unknown check-in" });
  }
  return c.json(checkInPromptSchema.parse(checkInPrompt(parsed.data)));
});

checkInRoutes.post("/", requireAuth, async (c) => {
  const raw: unknown = await c.req.json().catch(() => null);
  const parsed = checkInInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HTTPException(400, { message: "Choose what feels closest" });
  }
  if (!answerIsValid(parsed.data.promptId, parsed.data.answer)) {
    throw new HTTPException(400, { message: "Choose one of the options" });
  }
  const user = c.get("user");
  if (!(await checkRateLimit(c.env, `checkin:${user.id}`, 60, 60))) {
    c.header("Retry-After", "60");
    throw new HTTPException(429, { message: "Take a moment, then try again" });
  }
  const pattern = await recordCheckIn(c.env, user.id, parsed.data, new Date());
  return c.json(checkInResponseSchema.parse({ ok: true, pattern }));
});

export const insightRoutes = new Hono<AppEnv>();

insightRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  return c.json(patternsResponseSchema.parse({ items: await listPatterns(c.env, user.id) }));
});

export const topicRoutes = new Hono<AppEnv>();

topicRoutes.get("/:slug", async (c) => {
  const row = await topicBySlug(c.env, c.req.param("slug"));
  const topic = row ? publicTopic(row) : null;
  if (!topic) {
    throw new HTTPException(404, { message: "Topic not found" });
  }
  return c.json(psychTopicSchema.parse(topic));
});
