import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

describe("seed safety", () => {
  it("upserts instead of replacing or deleting parent rows", () => {
    // Given the seed file
    const seed = readFileSync("apps/api/seed.sql", "utf8");

    // When it is checked for destructive statements
    // Then it never uses REPLACE or deletes parent rows
    expect(seed).not.toMatch(/INSERT\s+OR\s+REPLACE/iu);
    expect(seed).not.toMatch(/DELETE\s+FROM\s+communities/iu);
  });
});
