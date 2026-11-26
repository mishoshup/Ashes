import type { PromptId, Trigger } from "@ashes/contracts";

export const PATTERN_THRESHOLD = 3;

export type PromptOption = {
  value: string;
  label: string;
  tags: Trigger[];
};

export type PromptDefinition = {
  id: PromptId;
  question: string;
  options: PromptOption[];
};

export const PROMPTS: Record<PromptId, PromptDefinition> = {
  onboarding: {
    id: "onboarding",
    question: "What do you enjoy or rely on most about smoking?",
    options: [
      { value: "break", label: "A break from responsibility", tags: ["boredom", "routine"] },
      { value: "hands", label: "Something to do with my hands", tags: ["routine"] },
      { value: "alone", label: "A moment alone", tags: ["emotional", "avoidance"] },
      { value: "nicotine", label: "The nicotine itself", tags: ["cravings"] },
      { value: "routine", label: "A familiar routine", tags: ["routine"] },
      { value: "not_sure", label: "I'm not sure", tags: ["not_sure"] },
    ],
  },
  trigger: {
    id: "trigger",
    question: "When do you most often want to smoke?",
    options: [
      { value: "stress", label: "When I'm stressed", tags: ["stress"] },
      { value: "social", label: "When I'm around other people", tags: ["social"] },
      { value: "boredom", label: "When I'm bored", tags: ["boredom"] },
      { value: "routine", label: "As part of my routine", tags: ["routine"] },
      { value: "emotional", label: "When I'm feeling emotional", tags: ["emotional"] },
      { value: "reward", label: "When I want a reward", tags: ["reward"] },
      { value: "identity", label: "When it feels like part of who I am", tags: ["identity"] },
      { value: "avoidance", label: "When I want to avoid something", tags: ["avoidance"] },
      { value: "cravings", label: "When a craving hits", tags: ["cravings"] },
      { value: "not_sure", label: "I'm not sure", tags: ["not_sure"] },
    ],
  },
  context: {
    id: "context",
    question: "Do you smoke more when you're alone or around other people?",
    options: [
      { value: "alone", label: "When I'm alone", tags: ["emotional", "boredom"] },
      { value: "people", label: "Around other people", tags: ["social"] },
      { value: "both", label: "Both, depending on the situation", tags: ["social"] },
      { value: "not_sure", label: "I'm not sure", tags: ["not_sure"] },
    ],
  },
  break: {
    id: "break",
    question: "Is it the cigarette or the break you actually want?",
    options: [
      { value: "break", label: "A break from responsibility", tags: ["boredom", "routine"] },
      { value: "hands", label: "Something to do with my hands", tags: ["routine"] },
      { value: "alone", label: "A moment alone", tags: ["emotional", "avoidance"] },
      { value: "nicotine", label: "The nicotine itself", tags: ["cravings"] },
      { value: "routine", label: "A familiar routine", tags: ["routine"] },
      { value: "not_sure", label: "I'm not sure", tags: ["not_sure"] },
    ],
  },
  craving: {
    id: "craving",
    question: "What do you need right now?",
    options: [
      { value: "pause", label: "A pause", tags: ["stress", "boredom"] },
      { value: "activity", label: "Something to do with my hands", tags: ["routine"] },
      { value: "alone", label: "A moment alone", tags: ["emotional", "avoidance"] },
      { value: "support", label: "Someone to talk to", tags: ["social"] },
      { value: "not_sure", label: "I'm not sure", tags: ["not_sure"] },
    ],
  },
  slip: {
    id: "slip",
    question: "What triggered it?",
    options: [
      { value: "stress", label: "Stress", tags: ["stress"] },
      { value: "social", label: "A social situation", tags: ["social"] },
      { value: "alcohol", label: "Alcohol or nightlife", tags: ["social"] },
      { value: "boredom", label: "Boredom", tags: ["boredom"] },
      { value: "craving", label: "A strong craving", tags: ["cravings"] },
      { value: "emotional", label: "An emotional situation", tags: ["emotional"] },
      { value: "habit", label: "Habit or routine", tags: ["routine"] },
      { value: "other", label: "Something else", tags: ["not_sure"] },
      { value: "not_sure", label: "I'm not sure", tags: ["not_sure"] },
    ],
  },
  milestone: {
    id: "milestone",
    question: "What helped you get here?",
    options: [
      { value: "support", label: "Support from someone", tags: ["social"] },
      { value: "community", label: "The community", tags: ["social"] },
      { value: "reflection", label: "My reflections", tags: ["identity"] },
      { value: "routine", label: "A new routine", tags: ["routine"] },
      { value: "other", label: "Something else", tags: ["not_sure"] },
    ],
  },
  pattern: {
    id: "pattern",
    question: "Does this pattern sound like you?",
    options: [
      { value: "yes", label: "Yes, that fits", tags: [] },
      { value: "partly", label: "Partly", tags: [] },
      { value: "no", label: "Not really", tags: [] },
    ],
  },
  notice: {
    id: "notice",
    question: "What do you notice about this craving?",
    options: [
      { value: "time", label: "The time of day", tags: ["routine"] },
      { value: "place", label: "Where I am", tags: ["routine"] },
      { value: "people", label: "Who I'm with", tags: ["social"] },
      { value: "feeling", label: "How I feel", tags: ["emotional"] },
      { value: "not_sure", label: "I'm not sure", tags: ["not_sure"] },
    ],
  },
};

export function promptFor(id: PromptId): PromptDefinition {
  return PROMPTS[id];
}

export function promptTags(id: PromptId, answer: string): Trigger[] {
  const option = PROMPTS[id].options.find((candidate) => candidate.value === answer);
  return option?.tags ?? [];
}
