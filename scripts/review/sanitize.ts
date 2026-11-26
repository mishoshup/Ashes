export function sanitizeInline(value: string, maxLength = 600): string {
  return value
    .replace(/\s+/gu, " ")
    .replaceAll("@", "@\u200b")
    .replaceAll("`", "'")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .trim()
    .slice(0, maxLength);
}
