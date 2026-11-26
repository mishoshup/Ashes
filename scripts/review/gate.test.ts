import { describe, expect, it, spyOn } from "bun:test";

import { escapeWorkflowCommand, postCommentOrFail, requireCommentCredentials } from "./gate";

describe("review gate", () => {
  it("escapes workflow command data", () => {
    // Given a message containing command separators
    // When it is escaped for a GitHub annotation
    // Then %, CR, and LF are encoded
    expect(escapeWorkflowCommand("a%\nb\r")).toBe("a%25%0Ab%0D");
  });

  it("requires comment credentials in CI", () => {
    // Given CI without a comment target
    // Then it rejects the run
    expect(() => requireCommentCredentials({ isCi: true })).toThrow();

    // And local runs may continue without posting
    expect(() => requireCommentCredentials({ isCi: false })).not.toThrow();
  });

  it("fails when the review comment cannot be posted", async () => {
    // Given a GitHub comment write that fails
    const previousCode = process.exitCode;
    const previousActions = process.env.GITHUB_ACTIONS;
    const previousError = spyOn(console, "error").mockImplementation(() => {});
    process.env.GITHUB_ACTIONS = "";

    try {
      // When the comment is posted
      await postCommentOrFail(async () => {
        throw new Error("boom");
      });

      // Then the review fails loudly
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousCode ?? 0;
      if (previousActions === undefined) {
        delete process.env.GITHUB_ACTIONS;
      } else {
        process.env.GITHUB_ACTIONS = previousActions;
      }
      previousError.mockRestore();
    }
  });
});
