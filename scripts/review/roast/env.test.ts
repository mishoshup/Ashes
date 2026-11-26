import { describe, expect, it } from "bun:test";

import { buildRoastEnv } from "./env";

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
});
