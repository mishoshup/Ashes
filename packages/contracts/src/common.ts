import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
export const isoDateSchema = z.iso.datetime();
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a six-digit hex colour");

export const handleSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/, "Handles use lowercase letters, numbers and underscores");

export const postKindSchema = z.enum(["post", "article", "poll"]);
export type PostKind = z.infer<typeof postKindSchema>;

export const channelKindSchema = z.enum(["chat", "forum", "mixed"]);
export type ChannelKind = z.infer<typeof channelKindSchema>;

export const visibilitySchema = z.enum(["public", "private"]);
export type Visibility = z.infer<typeof visibilitySchema>;

export const badgeTierSchema = z.enum(["bronze", "silver", "gold"]);
export type BadgeTier = z.infer<typeof badgeTierSchema>;

export const badgeIconSchema = z.enum([
  "spark",
  "flame",
  "moon",
  "quill",
  "seal",
  "leaf",
  "bell",
  "compass",
  "key",
  "feather",
]);
export type BadgeIcon = z.infer<typeof badgeIconSchema>;

export const errorCodeSchema = z.enum([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "payload_too_large",
  "unsupported_media_type",
  "internal",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ApiErrorPayload = z.infer<typeof apiErrorSchema>;

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export const uploadResponseSchema = z.object({
  url: z.string().min(1),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
