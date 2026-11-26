export function fail(message: string): void {
  console.error(message);
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error(`::error::${message.replaceAll("\n", " ")}`);
  }
  process.exitCode = 1;
}
