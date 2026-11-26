import { z } from "zod";
import { chatMessageSchema } from "./chat";

export const wsServerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ready"),
    room: z.string(),
    online: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("presence"),
    online: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("message"),
    message: chatMessageSchema,
  }),
  z.object({
    type: z.literal("typing"),
    handle: z.string(),
    displayName: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);
export type WsServerEvent = z.infer<typeof wsServerEventSchema>;

export const wsClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("typing") }),
  z.object({ type: z.literal("ping") }),
]);
export type WsClientEvent = z.infer<typeof wsClientEventSchema>;
