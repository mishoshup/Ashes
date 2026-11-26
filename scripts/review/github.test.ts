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

  it("preserves verbatim code quotes while escaping HTML outside code", () => {
    // Given a report with inline code, a fenced block, and prose
    const body = [
      "`Map<string, number>`",
      "",
      "```tsx",
      "<div>@user</div>",
      "```",
      "",
      "outside @team <b>",
    ].join("\n");

    // When the comment body is built
    const comment = buildCommentBody(body);

    // Then code stays verbatim and only prose is escaped
    expect(comment).toContain("`Map<string, number>`");
    expect(comment).toContain("<div>@user</div>");
    expect(comment).toContain("outside @\u200bteam &lt;b&gt;");
  });

  it("does not treat an escaped backtick as a code delimiter", () => {
    // Given a backslash-escaped backtick
    const body = "a \\`<img src=x> b";

    // When the comment body is built
    const comment = buildCommentBody(body);

    // Then the tag is escaped, not copied as code
    expect(comment).toContain("&lt;img src=x&gt;");
  });

  it("does not treat an unclosed fence as code", () => {
    // Given an opening fence with no closing fence
    const body = ["```", "<img src=x>", "tail"].join("\n");

    // When the comment body is built
    const comment = buildCommentBody(body);

    // Then the unterminated fence is neutralized and following prose is escaped
    expect(comment).toContain("&#96;&#96;&#96;");
    expect(comment).toContain("&lt;img src=x&gt;");
  });

  it("does not treat a four-space-indented fence as code", () => {
    // Given a line that CommonMark treats as an indented code block, not a fence
    const body = ["    ```", "<img src=x>", "    ```"].join("\n");

    // When the comment body is built
    const comment = buildCommentBody(body);

    // Then the following prose HTML is escaped
    expect(comment).toContain("&lt;img src=x&gt;");
  });

  it("truncates reports over the GitHub limit", () => {
    // Given a report larger than the comment cap
    const comment = buildCommentBody("a".repeat(70_000));

    // Then it is clipped and marked
    expect(comment).toContain("_Report truncated._");
    expect(comment.length).toBeLessThan(61_000);
  });
});
