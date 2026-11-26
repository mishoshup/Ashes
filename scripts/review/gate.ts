export function fail(message: string): void {
  console.error(message);
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error(`::error::${message.replaceAll("\n", " ")}`);
  }
  process.exitCode = 1;
}

export async function postCommentOrFail(post: () => Promise<void>): Promise<void> {
  try {
    await post();
  } catch (error) {
    fail(`Agent review comment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
