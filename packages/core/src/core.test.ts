import { describe, expect, it } from "bun:test";
import { excerpt, formatCount, parseProse, relativeTime, slugify } from "./index";

describe("relativeTime", () => {
  const now = Date.parse("2026-11-26T12:00:00.000Z");

  it("returns compact units", () => {
    expect(relativeTime("2026-11-26T11:59:30.000Z", now)).toBe("now");
    expect(relativeTime("2026-11-26T11:55:00.000Z", now)).toBe("5m");
    expect(relativeTime("2026-11-26T09:00:00.000Z", now)).toBe("3h");
    expect(relativeTime("2026-11-23T12:00:00.000Z", now)).toBe("3d");
  });

  it("falls back to a date for old values", () => {
    expect(relativeTime("2026-01-02T12:00:00.000Z", now)).toBe("2 Jan");
  });
});

describe("counts and text", () => {
  it("formats compact counts", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(2481)).toBe("2.5k");
    expect(formatCount(12400)).toBe("12k");
  });

  it("makes slugs and excerpts", () => {
    expect(slugify("Late Night Thoughts!")).toBe("late-night-thoughts");
    expect(excerpt("**Hello** world, this is a long sentence.", 12)).toBe("Hello world…");
  });
});

describe("prose", () => {
  it("parses headings, lists, quotes and inline spans", () => {
    const blocks = parseProse("## Why\n\n**Because** it works.\n\n- one\n- two\n\n> a quote");
    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "list", "quote"]);
    expect(blocks[1]).toEqual({
      type: "paragraph",
      spans: [{ text: "Because", bold: true }, { text: " it works." }],
    });
  });
});
