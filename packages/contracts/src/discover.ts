import { z } from "zod";
import { channelSummarySchema } from "./channel";
import { hexColorSchema, idSchema } from "./common";
import { communitySummarySchema, communityWithChannelsSchema } from "./community";
import { eventSchema } from "./event";
import { postSummarySchema } from "./post";
import { userSummarySchema } from "./user";

export const writerSummarySchema = z.object({
  user: userSummarySchema,
  articleCount: z.number().int().min(0),
  likeCount: z.number().int().min(0),
  latestTitle: z.string().nullable(),
});
export type WriterSummary = z.infer<typeof writerSummarySchema>;

export const discoverPayloadSchema = z.object({
  communities: z.array(communitySummarySchema),
  channels: z.array(channelSummarySchema),
  articles: z.array(postSummarySchema),
  discussions: z.array(postSummarySchema),
  writers: z.array(writerSummarySchema),
  events: z.array(eventSchema),
});
export type DiscoverPayload = z.infer<typeof discoverPayloadSchema>;

export const searchPayloadSchema = z.object({
  query: z.string(),
  communities: z.array(communitySummarySchema),
  channels: z.array(channelSummarySchema),
  articles: z.array(postSummarySchema),
  posts: z.array(postSummarySchema),
  people: z.array(userSummarySchema),
});
export type SearchPayload = z.infer<typeof searchPayloadSchema>;

export const homePayloadSchema = z.object({
  communities: z.array(communityWithChannelsSchema),
  recentChannels: z.array(channelSummarySchema),
  recommended: z.array(communitySummarySchema),
  unreadChats: z.number().int().min(0),
  activeWriters: z.array(userSummarySchema),
});
export type HomePayload = z.infer<typeof homePayloadSchema>;

export const communityPagePayloadSchema = z.object({
  detail: z.object({
    community: communitySummarySchema,
    channels: z.array(channelSummarySchema),
    members: z.array(userSummarySchema),
    events: z.array(eventSchema),
    role: z.enum(["member", "moderator"]).nullable(),
  }),
  recentPosts: z.array(postSummarySchema),
});
export type CommunityPagePayload = z.infer<typeof communityPagePayloadSchema>;

export const accentOptionSchema = z.object({
  label: z.string(),
  value: hexColorSchema,
});

export const memberDirectorySchema = z.object({
  items: z.array(
    z.object({
      user: userSummarySchema,
      sharedCommunities: z.number().int().min(0),
      existingChatId: idSchema.nullable(),
    }),
  ),
});
export type MemberDirectory = z.infer<typeof memberDirectorySchema>;
