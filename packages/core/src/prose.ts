export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type ProseBlock =
  | { type: "heading"; level: 2 | 3; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "quote"; spans: InlineSpan[] }
  | { type: "list"; items: InlineSpan[][] }
  | { type: "divider" };

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*)/gu;

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  for (const part of text.split(INLINE_PATTERN)) {
    if (!part) {
      continue;
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      spans.push({ text: part.slice(2, -2), bold: true });
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      spans.push({ text: part.slice(1, -1), italic: true });
    } else {
      spans.push({ text: part });
    }
  }
  return spans;
}

/**
 * A deliberately small prose format for Ashes articles: paragraphs, h2/h3,
 * blockquotes, flat lists, dividers and bold/italic spans. Not full Markdown.
 */
export function parseProse(body: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  const lines = body.replace(/\r\n/gu, "\n").split("\n");
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", spans: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push({ type: "quote", spans: parseInline(quote.join(" ")) });
      quote = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ type: "list", items: list.map((item) => parseInline(item)) });
      list = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushQuote();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }
    if (trimmed === "---") {
      flushAll();
      blocks.push({ type: "divider" });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushAll();
      blocks.push({ type: "heading", level: 3, spans: parseInline(trimmed.slice(4)) });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushAll();
      blocks.push({ type: "heading", level: 2, spans: parseInline(trimmed.slice(3)) });
      continue;
    }
    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      quote.push(trimmed.slice(2));
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      flushQuote();
      list.push(trimmed.slice(2));
      continue;
    }

    flushQuote();
    flushList();
    paragraph.push(trimmed);
  }

  flushAll();
  return blocks;
}

export function proseToPlainText(body: string): string {
  return parseProse(body)
    .map((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
        case "quote":
          return block.spans.map((span) => span.text).join("");
        case "list":
          return block.items.map((item) => item.map((span) => span.text).join("")).join(" · ");
        case "divider":
          return "";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
