import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

describe("seed safety", () => {
  it("upserts instead of replacing or deleting parent rows", () => {
    const seed = readFileSync("apps/api/seed.sql", "utf8");
    expect(seed).not.toMatch(/INSERT\s+OR\s+REPLACE/iu);
    expect(seed).not.toMatch(/DELETE\s+FROM\s+communities/iu);
  });
});
