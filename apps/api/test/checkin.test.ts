import {
  authSessionResponseSchema,
  checkInResponseSchema,
  checkInPromptSchema,
  magicLinkResponseSchema,
  patternsResponseSchema,
  psychTopicSchema,
  psychTopicsResponseSchema,
} from "@ashes/contracts";
import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

async function post(path: string, body: unknown, token?: string, ip = "local") {
  return SELF.fetch(`https://example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function newSession(email: string): Promise<string> {
  const ip = `ip-${crypto.randomUUID()}`;
  const magic = await post("/api/auth/magic-link", { email }, undefined, ip);
  const body = magicLinkResponseSchema.parse(await magic.json());
  const verify = await post("/api/auth/verify", { token: body.devToken }, undefined, ip);
  return authSessionResponseSchema.parse(await verify.json()).token;
}

async function checkIn(
  token: string,
  input: { promptId: string; answer: string },
): Promise<ReturnType<typeof checkInResponseSchema.parse>> {
  const response = await post("/api/check-in", input, token);
  expect(response.status).toBe(200);
  return checkInResponseSchema.parse(await response.json());
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO psych_topics
       (slug, trigger, title, summary, body, reflection_prompt, insight_body, channel_id, created_at)
       VALUES ('stress', 'stress', 'Smoking when you are stressed', 'Pressure and smoking.',
       'A short explanation.', 'What happens before?', 'Maybe smoking has become your way of coping with pressure.',
       NULL, '2026-11-01T09:00:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO psych_topics
       (slug, trigger, title, summary, body, reflection_prompt, insight_body, channel_id, created_at)
       VALUES ('social', 'social', 'Smoking around other people', 'People and smoking.',
       'A short explanation.', 'Who are you with?', 'Maybe smoking is doing some of the social work for you.',
       NULL, '2026-11-01T09:00:00.000Z')`,
    ),
  ]);
});

describe("situation prompts", () => {
  it("serves different questions from the situation bank", async () => {
    // Given a signed-in user
    const token = await newSession("prompts@example.com");

    // When the default and context prompts are requested
    const trigger = await SELF.fetch("https://example.com/api/check-in", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const context = await SELF.fetch("https://example.com/api/check-in?kind=context", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Then they are different questions from the use case
    const triggerPrompt = checkInPromptSchema.parse(await trigger.json());
    const contextPrompt = checkInPromptSchema.parse(await context.json());
    expect(triggerPrompt.question).toBe("When do you most often want to smoke?");
    expect(contextPrompt.question).toBe(
      "Do you smoke more when you're alone or around other people?",
    );
    expect(triggerPrompt.options.some((option) => option.value === "stress")).toBe(true);
    expect(contextPrompt.options.some((option) => option.value === "people")).toBe(true);
  });

  it("only shows a pattern after three matching answers", async () => {
    // Given a signed-in user
    const token = await newSession("pattern@example.com");

    // When stress is selected twice
    const first = await checkIn(token, { promptId: "trigger", answer: "stress" });
    const second = await checkIn(token, { promptId: "trigger", answer: "stress" });

    // Then there is no insight yet
    expect(first.pattern?.reached).toBe(false);
    expect(second.pattern?.count).toBe(2);
    expect(second.pattern?.insight).toBeNull();

    // When it is selected a third time
    const third = await checkIn(token, { promptId: "trigger", answer: "stress" });

    // Then the pattern appears as a tentative observation
    expect(third.pattern?.reached).toBe(true);
    expect(third.pattern?.count).toBe(3);
    expect(third.pattern?.insight?.body).toContain("coping with pressure");
    expect(third.pattern?.topic?.slug).toBe("stress");
  });

  it("uses the alone-or-people answer to find a social pattern", async () => {
    // Given a signed-in user
    const token = await newSession("social@example.com");

    // When they choose "around other people" three times
    await checkIn(token, { promptId: "context", answer: "people" });
    await checkIn(token, { promptId: "context", answer: "people" });
    const third = await checkIn(token, { promptId: "context", answer: "people" });

    // Then the pattern is about social situations
    expect(third.pattern?.trigger).toBe("social");
    expect(third.pattern?.reached).toBe(true);
    expect(third.pattern?.channel).toBeNull();
  });

  it("does not turn 'I'm not sure' into a pattern", async () => {
    // Given a signed-in user
    const token = await newSession("not-sure@example.com");

    // When they choose "I'm not sure" repeatedly
    await checkIn(token, { promptId: "trigger", answer: "not_sure" });
    await checkIn(token, { promptId: "trigger", answer: "not_sure" });
    const third = await checkIn(token, { promptId: "trigger", answer: "not_sure" });

    // Then the app does not diagnose them
    expect(third.pattern?.reached).toBe(false);
    expect(third.pattern?.insight).toBeNull();

    // And "not_sure" is excluded from insights
    const insights = await SELF.fetch("https://example.com/api/insights", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(patternsResponseSchema.parse(await insights.json()).items).toHaveLength(0);
  });

  it("returns the related psychology topic", async () => {
    // Given a signed-in user
    const token = await newSession("topic@example.com");

    // When the stress topic is requested
    const response = await SELF.fetch("https://example.com/api/topics/stress", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Then the psychology content is returned
    expect(response.status).toBe(200);
    expect(psychTopicSchema.parse(await response.json()).title).toContain("stressed");
  });

  it("lists sample psychology before registration", async () => {
    // When a visitor opens the topic index without a session
    const response = await SELF.fetch("https://example.com/api/topics");

    // Then the editorial index is public
    expect(response.status).toBe(200);
    const body = psychTopicsResponseSchema.parse(await response.json());
    expect(body.items.map((topic) => topic.slug).toSorted()).toEqual(["social", "stress"]);
  });

  it("serves a sample psychology topic before registration", async () => {
    // When a visitor opens a topic without a session
    const response = await SELF.fetch("https://example.com/api/topics/stress");

    // Then the editorial sample is public
    expect(response.status).toBe(200);
    expect(psychTopicSchema.parse(await response.json()).slug).toBe("stress");
  });

  it("rejects an option that does not belong to the prompt", async () => {
    // Given a signed-in user
    const token = await newSession("invalid@example.com");

    // When a context prompt receives a trigger-only answer
    const response = await post("/api/check-in", { promptId: "context", answer: "stress" }, token);

    // Then it is rejected
    expect(response.status).toBe(400);
  });

  it("requires a session", async () => {
    const response = await SELF.fetch("https://example.com/api/check-in");
    expect(response.status).toBe(401);
  });
});
