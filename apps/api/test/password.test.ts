import { base64StandardDecode, base64StandardEncode } from "../src/lib/crypto";
import { describe, expect, it } from "vitest";

describe("standard base64", () => {
  it("encodes and decodes the standard alphabet with plus and slash", () => {
    // Given bytes whose standard base64 contains '+' and '/'
    const bytes = new Uint8Array([0xfb, 0xff]);

    // When encoded and decoded
    const encoded = base64StandardEncode(bytes);
    const decoded = base64StandardDecode(encoded);

    // Then the standard alphabet is used, not URL-safe base64
    expect(encoded).toBe("+/8");
    expect(encoded).not.toContain("-");
    expect(encoded).not.toContain("_");
    expect(decoded).not.toBeNull();
    expect([...(decoded ?? [])]).toEqual([0xfb, 0xff]);
  });
});
