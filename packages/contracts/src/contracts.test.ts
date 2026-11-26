import { describe, expect, it } from "bun:test";
import {
  createPostInputSchema,
  loginInputSchema,
  paginatedSchema,
  registerInputSchema,
  userSummarySchema,
} from "./index";

describe("auth contracts", () => {
  it("accepts a valid registration", () => {
    const value = registerInputSchema.parse({
      email: "Alex@Example.com",
      password: "long-enough-password",
      handle: "alex_1",
      displayName: "Alex",
    });
    expect(value.email).toBe("Alex@Example.com");
  });

  it("rejects a short password and bad handle", () => {
    expect(
      registerInputSchema.safeParse({
        email: "a@b.com",
        password: "short",
        handle: "Bad Handle",
        displayName: "A",
      }).success,
    ).toBe(false);
  });

  it("validates login input", () => {
    expect(loginInputSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});

describe("post contracts", () => {
  it("requires an article title and body length", () => {
    expect(
      createPostInputSchema.safeParse({
        channelId: "ch_1",
        kind: "article",
        title: "My story",
        body: "too short",
      }).success,
    ).toBe(false);
  });

  it("requires two unique poll options", () => {
    expect(
      createPostInputSchema.safeParse({
        channelId: "ch_1",
        kind: "poll",
        title: "What triggers you?",
        pollOptions: ["Stress", "stress"],
      }).success,
    ).toBe(false);
  });

  it("accepts a short post", () => {
    expect(
      createPostInputSchema.safeParse({
        channelId: "ch_1",
        kind: "post",
        body: "Anyone around tonight?",
      }).success,
    ).toBe(true);
  });
});

describe("shared shapes", () => {
  it("parses a user summary and a page", () => {
    const user = userSummarySchema.parse({
      id: "usr_1",
      handle: "cloudnine",
      displayName: "Cloud Nine",
      accent: "#ff6a3d",
      avatarEmoji: null,
    });
    expect(user.handle).toBe("cloudnine");
    expect(
      paginatedSchema(userSummarySchema).parse({ items: [user], nextCursor: null }).items,
    ).toHaveLength(1);
  });
});
