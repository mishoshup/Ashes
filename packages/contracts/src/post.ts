import { z } from "zod";
import { channelSummarySchema } from "./channel";
import {
  channelKindSchema,
  hexColorSchema,
  idSchema,
  isoDateSchema,
  postKindSchema,
} from "./common";
import { communitySummarySchema } from "./community";
import { eventSchema } from "./event";
import { userSummarySchema } from "./user";

export const pollOptionSchema = z.object({
  id: idSchema,
  label: z.string(),
  voteCount: z.number().int().min(0),
});
export type PollOption = z.infer<typeof pollOptionSchema>;

export const pollSchema = z.object({
  id: idSchema,
  totalVotes: z.number().int().min(0),
  myOptionId: idSchema.nullable(),
  options: z.array(pollOptionSchema),
});
export type Poll = z.infer<typeof pollSchema>;

export const postSummarySchema = z.object({
  id: idSchema,
  channelId: idSchema,
  channelName: z.string(),
  communityId: idSchema,
  communityName: z.string(),
  communitySlug: z.string(),
  communityAccent: hexColorSchema,
  kind: postKindSchema,
  title: z.string().nullable(),
  excerpt: z.string(),
  coverImageUrl: z.string().nullable(),
  createdAt: isoDateSchema,
  author: userSummarySchema,
  likeCount: z.number().int().min(0),
  commentCount: z.number().int().min(0),
  liked: z.boolean(),
  readMinutes: z.number().int().min(1),
  pinned: z.boolean(),
  poll: pollSchema.nullable(),
});
export type PostSummary = z.infer<typeof postSummarySchema>;

export const commentSchema = z.object({
  id: idSchema,
  postId: idSchema,
  body: z.string(),
  createdAt: isoDateSchema,
  author: userSummarySchema,
});
export type Comment = z.infer<typeof commentSchema>;

export const postDetailSchema = postSummarySchema.extend({
  body: z.string(),
  comments: z.array(commentSchema),
});
export type PostDetail = z.infer<typeof postDetailSchema>;

const mediaUrlSchema = z
  .string()
  .max(500)
  .refine(
    (value) => /^https?:\/\//u.test(value) || value.startsWith("/uploads/"),
    "Expected an https URL or an /uploads/ path",
  );

export const createPostInputSchema = z
  .object({
    channelId: idSchema,
    kind: postKindSchema,
    title: z.string().trim().max(160).optional(),
    body: z.string().max(40_000).default(""),
    coverImageUrl: mediaUrlSchema.nullable().optional(),
    pollOptions: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "article") {
      if (!value.title || value.title.length < 3) {
        ctx.addIssue({ code: "custom", path: ["title"], message: "Articles need a title" });
      }
      if (value.body.trim().length < 80) {
        ctx.addIssue({
          code: "custom",
          path: ["body"],
          message: "An article needs at least 80 characters",
        });
      }
    }
    if (value.kind === "post" && !value.body.trim() && !value.coverImageUrl) {
      ctx.addIssue({ code: "custom", path: ["body"], message: "Write something first" });
    }
    if (value.kind === "poll") {
      if (!value.title || value.title.length < 3) {
        ctx.addIssue({ code: "custom", path: ["title"], message: "Polls need a question" });
      }
      const options = value.pollOptions?.filter((option) => option.trim().length > 0) ?? [];
      if (options.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["pollOptions"],
          message: "Polls need at least two options",
        });
      }
      if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
        ctx.addIssue({ code: "custom", path: ["pollOptions"], message: "Options must be unique" });
      }
    }
  });
export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const createCommentInputSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first").max(2_000),
});
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

export const voteInputSchema = z.object({
  optionId: idSchema,
});
export type VoteInput = z.infer<typeof voteInputSchema>;

export const likeResponseSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number().int().min(0),
});
export type LikeResponse = z.infer<typeof likeResponseSchema>;

export const channelFeedPayloadSchema = z.object({
  channel: channelSummarySchema,
  community: communitySummarySchema,
  posts: z.array(postSummarySchema),
  nextCursor: z.string().nullable(),
});
export type ChannelFeedPayload = z.infer<typeof channelFeedPayloadSchema>;

export const channelBundleSchema = z.object({
  channel: channelSummarySchema,
  community: communitySummarySchema,
  kind: channelKindSchema,
  events: z.array(eventSchema),
});
export type ChannelBundle = z.infer<typeof channelBundleSchema>;
