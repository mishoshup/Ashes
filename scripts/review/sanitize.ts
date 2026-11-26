export function sanitizeComment(body: string): string {
  return body
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/@(?=[A-Za-z0-9_-])/gu, "@\u200b");
}
