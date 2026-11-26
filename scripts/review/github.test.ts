import { describe, expect, it } from "bun:test";

import { buildCommentBody, COMMENT_MARKER } from "./github";

describe("Roast GitHub comment", () => {
  it("neutralizes mentions and HTML comments", () => {
    // Given a report quoting author-controlled text
    const body = "hello @team <!-- hidden -->";

    // When the comment body is built
    const comment = buildCommentBody(body);

    // Then the marker stays, mentions are broken, and HTML comments are escaped
    expect(comment.startsWith(COMMENT_MARKER)).toBe(true);
    expect(comment).toContain("@\u200bteam");
    expect(comment).toContain("&lt;!-- hidden --&gt;");
  });

  it("truncates reports over the GitHub limit", () => {
    // Given a report larger than the comment cap
    const comment = buildCommentBody("a".repeat(70_000));

    // Then it is clipped and marked
    expect(comment).toContain("_Report truncated._");
    expect(comment.length).toBeLessThan(61_000);
  });
});
