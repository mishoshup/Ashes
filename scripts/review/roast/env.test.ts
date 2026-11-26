import { describe, expect, it } from "bun:test";

import { buildRoastEnv, reviewEnvSchema } from "./env";

describe("Roast environment", () => {
  it("does not give the write token to the third-party binary", () => {
    // Given a workflow environment with a write-scoped token
    const env = buildRoastEnv({
      PATH: "/usr/bin",
      HOME: "/home/runner",
      REVIEW_API_KEY: "review-key",
      GITHUB_TOKEN: "write-token",
      GH_TOKEN: "write-token",
    });

    // Then only the allowlisted review variables survive
    expect(env.REVIEW_API_KEY).toBe("review-key");
    expect(env.PATH).toBe("/usr/bin");
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.GH_TOKEN).toBeUndefined();
  });

  it("validates the PR number and repository shape", () => {
    // Given malformed identifiers
    // Then they are rejected before reaching a GitHub URL
    expect(reviewEnvSchema.safeParse({ PR_NUMBER: "1/2" }).success).toBe(false);
    expect(reviewEnvSchema.safeParse({ GITHUB_REPOSITORY: "not-a-repo" }).success).toBe(false);

    // And valid identifiers pass
    expect(
      reviewEnvSchema.safeParse({ PR_NUMBER: "12", GITHUB_REPOSITORY: "owner/repo" }).success,
    ).toBe(true);
  });
});
