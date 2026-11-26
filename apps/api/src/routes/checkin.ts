import {
  checkInInputSchema,
  checkInPromptSchema,
  checkInResponseSchema,
  patternsResponseSchema,
  promptIdSchema,
  psychTopicSchema,
  psychTopicsResponseSchema,
  slugSchema,
} from "@ashes/contracts";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { checkRateLimit } from "../lib/rate-limit";
import { requireAuth } from "../middleware/auth";
import {
  answerIsValid,
  checkInPrompt,
  listPatterns,
  listTopics,
  publicTopic,
  recordCheckIn,
  topicBySlug,
} from "../services/checkin";
import { hashRequestForKey, withIdempotency } from "../services/idempotency";
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
  const now = new Date();
  const idempotencyKey = c.req.header("Idempotency-Key");
  const response = await withIdempotency(
    c.env,
    user.id,
    idempotencyKey,
    await hashRequestForKey(c.env, idempotencyKey, parsed.data),
    checkInResponseSchema,
    now,
    async () =>
      checkInResponseSchema.parse({
        ok: true,
        pattern: await recordCheckIn(
          c.env,
          user.id,
          parsed.data,
          now,
          c.req.header("Idempotency-Key"),
        ),
      }),
  );
  return c.json(response);
});

export const insightRoutes = new Hono<AppEnv>();

insightRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  return c.json(patternsResponseSchema.parse({ items: await listPatterns(c.env, user.id) }));
});

export const topicRoutes = new Hono<AppEnv>();

topicRoutes.get("/", async (c) => {
  return c.json(psychTopicsResponseSchema.parse({ items: await listTopics(c.env) }));
});

topicRoutes.get("/:slug", async (c) => {
  const slug = slugSchema.safeParse(c.req.param("slug"));
  if (!slug.success) {
    throw new HTTPException(404, { message: "Topic not found" });
  }
  const row = await topicBySlug(c.env, slug.data);
  const topic = row ? publicTopic(row) : null;
  if (!topic) {
    throw new HTTPException(404, { message: "Topic not found" });
  }
  return c.json(psychTopicSchema.parse(topic));
});
