import { z } from "zod";
import { idSchema } from "./common";
import { eventSchema } from "./event";
import { postSummarySchema } from "./post";
import { badgeSchema } from "./user";

export const clubStatsSchema = z.object({
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  daysPresent: z.number().int().min(0),
  posts: z.number().int().min(0),
  articles: z.number().int().min(0),
  comments: z.number().int().min(0),
  likesReceived: z.number().int().min(0),
});
export type ClubStats = z.infer<typeof clubStatsSchema>;

export const clubPayloadSchema = z.object({
  stats: clubStatsSchema,
  badges: z.array(badgeSchema),
  events: z.array(eventSchema),
  featured: z.array(postSummarySchema),
  memberSince: z.string().datetime(),
});
export type ClubPayload = z.infer<typeof clubPayloadSchema>;

export const rsvpResponseSchema = z.object({
  rsvped: z.boolean(),
  rsvpCount: z.number().int().min(0),
});
export type RsvpResponse = z.infer<typeof rsvpResponseSchema>;

export const eventListSchema = z.object({
  items: z.array(eventSchema),
});

export const eventIdInputSchema = z.object({
  eventId: idSchema,
});
