import { z } from "zod";

import { sanitizeComment } from "./sanitize";

const commentSchema = z.object({
  id: z.number(),
  body: z.string().nullable().optional(),
});

const commentsSchema = z.array(commentSchema);

export const COMMENT_MARKER = "<!-- ashes-roast-review -->";
const MAX_BODY = 60_000;

export function buildCommentBody(body: string): string {
  const safe = sanitizeComment(body);
  const clipped =
    safe.length > MAX_BODY ? `${safe.slice(0, MAX_BODY)}\n\n_Report truncated._` : safe;
  return `${COMMENT_MARKER}\n${clipped}`;
}

export async function postReviewComment(input: {
  token: string;
  repo: string;
  pr: string;
  body: string;
}): Promise<void> {
  const headers = {
    Authorization: `Bearer ${input.token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const listResponse = await fetch(
    `https://api.github.com/repos/${input.repo}/issues/${input.pr}/comments?per_page=100`,
    { headers },
  );
  if (!listResponse.ok) {
    throw new Error(`GitHub comment list failed: ${listResponse.status}`);
  }
  const comments = commentsSchema.parse(await listResponse.json());
  const existing = comments.find((comment) => comment.body?.startsWith(COMMENT_MARKER));
  const url = existing
    ? `https://api.github.com/repos/${input.repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${input.repo}/issues/${input.pr}/comments`;
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers,
    body: JSON.stringify({ body: buildCommentBody(input.body) }),
  });
  if (!response.ok) {
    throw new Error(`GitHub comment write failed: ${response.status}`);
  }
}
