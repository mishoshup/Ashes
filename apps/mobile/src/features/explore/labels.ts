import type { ChannelKind, Trigger } from "@ashes/contracts";

export const triggerLabels: Record<Trigger, string> = {
  stress: "Stress",
  social: "Other people",
  boredom: "Boredom",
  routine: "Routine",
  emotional: "Feelings",
  reward: "Reward",
  identity: "Identity",
  avoidance: "Stepping away",
  cravings: "Cravings",
  not_sure: "Not sure",
};

export const channelKindLabels: Record<ChannelKind, string> = {
  chat: "Chat",
  forum: "Forum",
  mixed: "Chat + forum",
};
