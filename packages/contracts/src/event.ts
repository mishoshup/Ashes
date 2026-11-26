import { z } from "zod";
import { hexColorSchema, idSchema, isoDateSchema } from "./common";

export const eventSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string(),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema.nullable(),
  location: z.string(),
  communityId: idSchema.nullable(),
  communityName: z.string().nullable(),
  communityAccent: hexColorSchema.nullable(),
  rsvpCount: z.number().int().min(0),
  rsvped: z.boolean(),
});
export type AshesEvent = z.infer<typeof eventSchema>;
