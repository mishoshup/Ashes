import { z } from "zod";
import { idSchema } from "./common";

export const triggerSchema = z.enum([
  "stress",
  "social",
  "boredom",
  "routine",
  "emotional",
  "reward",
  "identity",
  "avoidance",
  "cravings",
  "not_sure",
]);
export type Trigger = z.infer<typeof triggerSchema>;

export const promptIdSchema = z.enum([
  "onboarding",
  "trigger",
  "context",
  "break",
  "craving",
  "slip",
  "milestone",
  "pattern",
  "notice",
]);
export type PromptId = z.infer<typeof promptIdSchema>;

export const promptOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type PromptOption = z.infer<typeof promptOptionSchema>;

export const checkInPromptSchema = z.object({
  id: promptIdSchema,
  question: z.string(),
  options: z.array(promptOptionSchema),
  threshold: z.number().int().min(1),
});
export type CheckInPrompt = z.infer<typeof checkInPromptSchema>;

export const checkInInputSchema = z.object({
  promptId: promptIdSchema,
  answer: z.string().min(1).max(40),
  feeling: z.string().trim().max(40).optional(),
  context: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CheckInInput = z.infer<typeof checkInInputSchema>;

export const patternInsightSchema = z.object({
  title: z.string(),
  body: z.string(),
  question: z.string(),
});
export type PatternInsight = z.infer<typeof patternInsightSchema>;

export const patternTopicSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
});
export type PatternTopic = z.infer<typeof patternTopicSchema>;

export const patternChannelSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
});
export type PatternChannel = z.infer<typeof patternChannelSchema>;

export const patternSchema = z.object({
  trigger: triggerSchema,
  count: z.number().int().min(0),
  threshold: z.number().int().min(1),
  reached: z.boolean(),
  insight: patternInsightSchema.nullable(),
  topic: patternTopicSchema.nullable(),
  channel: patternChannelSchema.nullable(),
});
export type Pattern = z.infer<typeof patternSchema>;

export const checkInResponseSchema = z.object({
  ok: z.literal(true),
  pattern: patternSchema.nullable(),
});
export type CheckInResponse = z.infer<typeof checkInResponseSchema>;

export const patternsResponseSchema = z.object({
  items: z.array(patternSchema),
});
export type PatternsResponse = z.infer<typeof patternsResponseSchema>;

export const psychTopicSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  reflectionPrompt: z.string().nullable(),
  trigger: triggerSchema,
  channel: patternChannelSchema.nullable(),
});
export type PsychTopic = z.infer<typeof psychTopicSchema>;
