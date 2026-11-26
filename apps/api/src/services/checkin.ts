import { triggerSchema, type CheckInInput, type PromptId, type Trigger } from "@ashes/contracts";
import type { Env } from "../types";
import { PATTERN_THRESHOLD, PROMPTS, promptFor, promptTags } from "../lib/prompts";

export type CheckInTopicRow = {
  slug: string;
  trigger: string;
  title: string;
  summary: string;
  body: string;
  reflection_prompt: string | null;
  insight_body: string;
  channel_id: string | null;
  channel_slug: string | null;
  channel_name: string | null;
  community_slug: string | null;
};

export function checkInPrompt(id: PromptId) {
  const prompt = promptFor(id);
  return {
    id: prompt.id,
    question: prompt.question,
    options: prompt.options.map(({ value, label }) => ({ value, label })),
    threshold: PATTERN_THRESHOLD,
  };
}

export async function topicByTrigger(env: Env, trigger: Trigger): Promise<CheckInTopicRow | null> {
  return env.DB.prepare(
    `SELECT pt.*, ch.id AS channel_id, ch.slug AS channel_slug, ch.name AS channel_name,
            c.slug AS community_slug
     FROM psych_topics pt
     LEFT JOIN channels ch ON ch.id = pt.channel_id
     LEFT JOIN communities c ON c.id = ch.community_id
     WHERE pt.trigger = ?`,
  )
    .bind(trigger)
    .first<CheckInTopicRow>();
}

export async function topicBySlug(env: Env, slug: string): Promise<CheckInTopicRow | null> {
  return env.DB.prepare(
    `SELECT pt.*, ch.id AS channel_id, ch.slug AS channel_slug, ch.name AS channel_name,
            c.slug AS community_slug
     FROM psych_topics pt
     LEFT JOIN channels ch ON ch.id = pt.channel_id
     LEFT JOIN communities c ON c.id = ch.community_id
     WHERE pt.slug = ?`,
  )
    .bind(slug)
    .first<CheckInTopicRow>();
}

function topicSummary(row: CheckInTopicRow) {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
  };
}

export async function listTopics(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT pt.*, ch.id AS channel_id, ch.slug AS channel_slug, ch.name AS channel_name,
            c.slug AS community_slug
     FROM psych_topics pt
     LEFT JOIN channels ch ON ch.id = pt.channel_id
     LEFT JOIN communities c ON c.id = ch.community_id
     ORDER BY CASE pt.trigger
       WHEN 'stress' THEN 0 WHEN 'social' THEN 1 WHEN 'boredom' THEN 2
       WHEN 'routine' THEN 3 WHEN 'emotional' THEN 4 WHEN 'reward' THEN 5
       WHEN 'identity' THEN 6 WHEN 'avoidance' THEN 7 WHEN 'cravings' THEN 8
       ELSE 9 END, pt.title COLLATE NOCASE`,
  ).all<CheckInTopicRow>();

  return rows.results.flatMap((row) => {
    const trigger = triggerSchema.safeParse(row.trigger);
    if (!trigger.success) {
      return [];
    }
    return [
      {
        ...topicSummary(row),
        trigger: trigger.data,
        channel: channelSummary(row),
      },
    ];
  });
}

function channelSummary(row: CheckInTopicRow) {
  if (!row.channel_id || !row.channel_slug || !row.channel_name || !row.community_slug) {
    return null;
  }
  return {
    id: row.channel_id,
    slug: row.channel_slug,
    name: row.channel_name,
    communitySlug: row.community_slug,
  };
}

const TRIGGER_LABEL: Record<Trigger, string> = {
  stress: "stress",
  social: "social situations",
  boredom: "boredom",
  routine: "your routine",
  emotional: "emotional moments",
  reward: "reward",
  identity: "identity",
  avoidance: "avoidance",
  cravings: "cravings",
  not_sure: "not being sure",
};

export async function getPattern(env: Env, trigger: Trigger, count: number) {
  const topic = trigger === "not_sure" ? null : await topicByTrigger(env, trigger);
  const reached = count >= PATTERN_THRESHOLD && topic !== null;
  return {
    trigger,
    count,
    threshold: PATTERN_THRESHOLD,
    reached,
    insight:
      reached && topic
        ? {
            title: `You’ve mentioned ${TRIGGER_LABEL[trigger]} ${count} times.`,
            body: topic.insight_body,
            question: "Want to explore this?",
          }
        : null,
    topic: reached && topic ? topicSummary(topic) : null,
    channel: reached && topic ? channelSummary(topic) : null,
  };
}

export async function countTag(env: Env, userId: string, tag: Trigger): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM check_in_tags t
     JOIN check_ins c ON c.id = t.check_in_id
     WHERE c.user_id = ? AND t.tag = ?`,
  )
    .bind(userId, tag)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function recordCheckIn(env: Env, userId: string, input: CheckInInput, now: Date) {
  const tags = [...new Set(promptTags(input.promptId, input.answer))];
  const id = `chk_${crypto.randomUUID().replaceAll("-", "").slice(0, 22)}`;
  const statements = [
    env.DB.prepare(
      `INSERT INTO check_ins (id, user_id, prompt_id, answer, feeling, context, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      userId,
      input.promptId,
      input.answer,
      input.feeling ?? null,
      input.context ?? null,
      input.note ?? null,
      now.toISOString(),
    ),
    ...tags.map((tag) =>
      env.DB.prepare("INSERT INTO check_in_tags (check_in_id, tag) VALUES (?, ?)").bind(id, tag),
    ),
  ];
  await env.DB.batch(statements);

  if (tags.length === 0) {
    return null;
  }
  const patterns = await Promise.all(tags.map((tag) => countTag(env, userId, tag)));
  const bestIndex = patterns.indexOf(Math.max(...patterns));
  const bestTag = tags[bestIndex];
  if (!bestTag) {
    return null;
  }
  return getPattern(env, bestTag, patterns[bestIndex] ?? 0);
}

export async function listPatterns(env: Env, userId: string) {
  const rows = await env.DB.prepare(
    `SELECT t.tag, COUNT(*) AS count FROM check_in_tags t
     JOIN check_ins c ON c.id = t.check_in_id
     WHERE c.user_id = ? AND t.tag != 'not_sure'
     GROUP BY t.tag ORDER BY count DESC`,
  )
    .bind(userId)
    .all<{ tag: string; count: number }>();
  return Promise.all(
    rows.results.flatMap((row) => {
      const trigger = triggerSchema.safeParse(row.tag);
      return trigger.success ? [getPattern(env, trigger.data, row.count)] : [];
    }),
  );
}

export function publicTopic(row: CheckInTopicRow) {
  const trigger = triggerSchema.safeParse(row.trigger);
  if (!trigger.success) {
    return null;
  }
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    reflectionPrompt: row.reflection_prompt,
    trigger: trigger.data,
    channel: channelSummary(row),
  };
}

export function answerIsValid(promptId: PromptId, answer: string): boolean {
  return PROMPTS[promptId].options.some((option) => option.value === answer);
}
