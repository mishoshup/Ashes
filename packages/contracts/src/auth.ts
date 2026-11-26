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

export const authClientSchema = z.enum(["web", "mobile"]).default("mobile");
export type AuthClient = z.infer<typeof authClientSchema>;

export const verifyMagicLinkInputSchema = z.object({
  token: z.string().min(20).max(256),
  client: authClientSchema,
});
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkInputSchema>;

export const authSessionResponseSchema = z.object({
  token: z.string().min(1),
  user: userSummarySchema,
  isNewUser: z.boolean(),
});
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const webAuthSessionResponseSchema = z.object({
  ok: z.literal(true),
  user: userSummarySchema,
  isNewUser: z.boolean(),
});
export type WebAuthSessionResponse = z.infer<typeof webAuthSessionResponseSchema>;

export const meResponseSchema = z.object({
  user: userSummarySchema,
  email: z.email(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const sessionTokenSchema = z.string().min(1).max(256);
export const userIdSchema = idSchema;

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(200, "Password is too long");

export const setPasswordInputSchema = z.object({
  password: passwordSchema,
  currentPassword: z.string().min(1).max(200).optional(),
});
export type SetPasswordInput = z.infer<typeof setPasswordInputSchema>;

export const passwordLoginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  client: authClientSchema,
});
export type PasswordLoginInput = z.infer<typeof passwordLoginInputSchema>;

export const sessionSummarySchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  userAgent: z.string().nullable(),
  current: z.boolean(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionsResponseSchema = z.object({
  items: z.array(sessionSummarySchema),
});
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;

export const revokeAllSessionsInputSchema = z.object({
  keepCurrent: z.boolean().default(true),
});
export type RevokeAllSessionsInput = z.infer<typeof revokeAllSessionsInputSchema>;

export const revokeAllSessionsResponseSchema = z.object({
  revoked: z.number().int().min(0),
});
export type RevokeAllSessionsResponse = z.infer<typeof revokeAllSessionsResponseSchema>;

export const setPasswordResponseSchema = z.object({
  ok: z.literal(true),
  token: z.string().optional(),
});
export type SetPasswordResponse = z.infer<typeof setPasswordResponseSchema>;
