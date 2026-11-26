import { z } from "zod";
import { idSchema } from "./common";
import { userSummarySchema } from "./user";

export const magicLinkInputSchema = z.object({
  email: z.email(),
  turnstileToken: z.string().max(4096).optional(),
});
export type MagicLinkInput = z.infer<typeof magicLinkInputSchema>;

export const magicLinkResponseSchema = z.object({
  ok: z.literal(true),
  devToken: z.string().optional(),
});
export type MagicLinkResponse = z.infer<typeof magicLinkResponseSchema>;

export const verifyMagicLinkInputSchema = z.object({
  token: z.string().min(20).max(256),
});
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkInputSchema>;

export const authSessionResponseSchema = z.object({
  token: z.string().min(1),
  user: userSummarySchema,
  isNewUser: z.boolean(),
});
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const meResponseSchema = z.object({
  user: userSummarySchema,
  email: z.email(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const sessionTokenSchema = z.string().min(1).max(256);
export const userIdSchema = idSchema;
