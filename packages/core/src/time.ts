const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toTime(input: string | Date): number {
  const time = input instanceof Date ? input.getTime() : Date.parse(input);
  return Number.isFinite(time) ? time : Number.NaN;
}

/** Compact, human relative time. Deterministic and locale-independent. */
export function relativeTime(input: string | Date, now: number = Date.now()): string {
  const time = toTime(input);
  if (Number.isNaN(time)) {
    return "";
  }
  const diff = Math.max(0, now - time);

  if (diff < 45_000) {
    return "now";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)}m`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)}h`;
  }
  if (diff < 7 * DAY) {
    return `${Math.floor(diff / DAY)}d`;
  }
  if (diff < 28 * DAY) {
    return `${Math.floor(diff / (7 * DAY))}w`;
  }

  const date = new Date(time);
  const sameYear = new Date(now).getFullYear() === date.getFullYear();
  const month = SHORT_MONTHS[date.getMonth()] ?? "";
  return sameYear
    ? `${date.getDate()} ${month}`
    : `${date.getDate()} ${month} ${date.getFullYear()}`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const count = Math.max(0, Math.round(value));
  if (count < 1_000) {
    return String(count);
  }
  if (count < 10_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (count < 1_000_000) {
    return `${Math.round(count / 1_000)}k`;
  }
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) {
    return "?";
  }
  const parts = cleaned.split(/\s+/u).filter(Boolean);
  if (parts.length === 1) {
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return `${(parts[0] ?? "").slice(0, 1)}${(parts[1] ?? "").slice(0, 1)}`.toUpperCase();
}

export function percent(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((count / total) * 100)));
}

export function slugify(value: string, maxLength = 48): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, maxLength);
}

export function excerpt(text: string, maxLength = 170): string {
  const plain = text
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/^\s{0,3}(#{1,6}|>)\s?/gmu, "")
    .replace(/^\s*[-*]\s+/gmu, "")
    .replace(/\*\*|__|\*|_/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  if (plain.length <= maxLength) {
    return plain;
  }
  const clipped = plain.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const body = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.trimEnd()}…`;
}

export function dayKey(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
