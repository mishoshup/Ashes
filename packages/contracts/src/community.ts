import { z } from "zod";
import { channelSummarySchema } from "./channel";
import { hexColorSchema, idSchema, visibilitySchema } from "./common";
import { eventSchema } from "./event";
import { userSummarySchema } from "./user";

export const communitySummarySchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  monogram: z.string().min(1).max(3),
  accent: hexColorSchema,
  visibility: visibilitySchema,
  memberCount: z.number().int().min(0),
  channelCount: z.number().int().min(0),
  joined: z.boolean(),
});
export type CommunitySummary = z.infer<typeof communitySummarySchema>;

export const communityWithChannelsSchema = communitySummarySchema.extend({
  channels: z.array(channelSummarySchema),
});
export type CommunityWithChannels = z.infer<typeof communityWithChannelsSchema>;

export const communityDetailSchema = z.object({
  community: communitySummarySchema,
  channels: z.array(channelSummarySchema),
  members: z.array(userSummarySchema),
  events: z.array(eventSchema),
  role: z.enum(["member", "moderator"]).nullable(),
});
export type CommunityDetail = z.infer<typeof communityDetailSchema>;
