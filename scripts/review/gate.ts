export function escapeWorkflowCommand(message: string): string {
  return message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

export function requireCommentCredentials(input: {
  isCi: boolean;
  token?: string;
  repo?: string;
  pr?: string;
}): void {
  if (input.token && input.repo && input.pr) {
    return;
  }
  if (input.isCi) {
    throw new Error(
      "GITHUB_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required in CI to post the review",
    );
  }
}

export function fail(message: string): void {
  // Keep the raw log on one line; an embedded newline could start another workflow command.
  console.error(message.replaceAll("\r", " ").replaceAll("\n", " "));
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error(`::error::${escapeWorkflowCommand(message)}`);
  }
  process.exitCode = 1;
}

export async function postCommentOrFail(post: () => Promise<void>): Promise<void> {
  try {
    await post();
  } catch (error) {
    fail(`Roast review comment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
