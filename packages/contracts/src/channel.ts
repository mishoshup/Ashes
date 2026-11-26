import { z } from "zod";
import { channelKindSchema, hexColorSchema, idSchema, visibilitySchema } from "./common";

export const channelSummarySchema = z.object({
  id: idSchema,
  communityId: idSchema,
  communityName: z.string(),
  communitySlug: z.string(),
  communityAccent: hexColorSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  kind: channelKindSchema,
  visibility: visibilitySchema,
  postCount: z.number().int().min(0),
  messageCount: z.number().int().min(0),
  lastActivityAt: z.string().datetime().nullable(),
});
export type ChannelSummary = z.infer<typeof channelSummarySchema>;

export const channelDetailSchema = z.object({
  channel: channelSummarySchema,
  memberCount: z.number().int().min(0),
  joined: z.boolean(),
  canPost: z.boolean(),
  onlineCount: z.number().int().min(0),
});
export type ChannelDetail = z.infer<typeof channelDetailSchema>;
