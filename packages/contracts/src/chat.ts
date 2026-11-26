import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";
import { userSummarySchema } from "./user";

export const conversationKindSchema = z.enum(["dm", "group"]);
export type ConversationKind = z.infer<typeof conversationKindSchema>;

export const chatMessageSchema = z.object({
  id: idSchema,
  roomId: idSchema,
  author: userSummarySchema,
  body: z.string(),
  createdAt: isoDateSchema,
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const lastMessageSchema = z.object({
  body: z.string(),
  createdAt: isoDateSchema,
  authorHandle: z.string(),
});
export type LastMessage = z.infer<typeof lastMessageSchema>;

export const chatSummarySchema = z.object({
  id: idSchema,
  kind: conversationKindSchema,
  title: z.string(),
  participants: z.array(userSummarySchema),
  lastMessage: lastMessageSchema.nullable(),
  unreadCount: z.number().int().min(0),
  updatedAt: isoDateSchema,
  communityName: z.string().nullable(),
});
export type ChatSummary = z.infer<typeof chatSummarySchema>;

export const chatDetailSchema = z.object({
  chat: chatSummarySchema,
  canPost: z.boolean(),
});
export type ChatDetail = z.infer<typeof chatDetailSchema>;

export const createDmInputSchema = z.object({
  userId: idSchema,
});
export type CreateDmInput = z.infer<typeof createDmInputSchema>;

export const createGroupInputSchema = z.object({
  title: z.string().trim().min(2).max(60),
  memberIds: z.array(idSchema).min(1).max(20),
});
export type CreateGroupInput = z.infer<typeof createGroupInputSchema>;

export const createMessageInputSchema = z.object({
  body: z.string().trim().min(1, "Write a message first").max(2_000),
});
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
