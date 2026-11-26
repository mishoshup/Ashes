import { z } from "zod";
import {
  badgeIconSchema,
  badgeTierSchema,
  handleSchema,
  hexColorSchema,
  isoDateSchema,
  idSchema,
} from "./common";

export const userSummarySchema = z.object({
  id: idSchema,
  handle: handleSchema,
  displayName: z.string().min(1).max(60),
  accent: hexColorSchema,
  avatarEmoji: z.string().max(8).nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const badgeProgressSchema = z.object({
  current: z.number().int().min(0),
  target: z.number().int().min(1),
  label: z.string(),
});
export type BadgeProgress = z.infer<typeof badgeProgressSchema>;

export const badgeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  icon: badgeIconSchema,
  tier: badgeTierSchema,
  earnedAt: isoDateSchema.nullable(),
  progress: badgeProgressSchema.nullable(),
});
export type Badge = z.infer<typeof badgeSchema>;

export const profileStatsSchema = z.object({
  posts: z.number().int().min(0),
  articles: z.number().int().min(0),
  comments: z.number().int().min(0),
  likesReceived: z.number().int().min(0),
  communities: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
});
export type ProfileStats = z.infer<typeof profileStatsSchema>;

export const userProfileSchema = userSummarySchema.extend({
  bio: z.string().max(280),
  createdAt: isoDateSchema,
  stats: profileStatsSchema,
  badges: z.array(badgeSchema),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const meSchema = z.object({
  user: userProfileSchema,
  email: z.email(),
  communityIds: z.array(idSchema),
});
export type Me = z.infer<typeof meSchema>;

export const authResponseSchema = z.object({
  token: z.string().min(1),
  session: meSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const registerInputSchema = z.object({
  email: z.email(),
  password: z.string().min(10).max(200),
  handle: handleSchema,
  displayName: z.string().trim().min(2).max(40),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const updateProfileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(280),
  avatarEmoji: z.string().max(8).nullable(),
  accent: hexColorSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const profilePayloadSchema = z.object({
  user: userProfileSchema,
  communities: z.array(
    z.object({
      id: idSchema,
      slug: z.string(),
      name: z.string(),
      monogram: z.string(),
      accent: hexColorSchema,
    }),
  ),
});
export type ProfilePayload = z.infer<typeof profilePayloadSchema>;
