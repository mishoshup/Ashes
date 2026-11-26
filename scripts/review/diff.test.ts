import { describe, expect, it } from "bun:test";
import { filterDiff } from "./diff";

describe("filterDiff", () => {
  it("removes lockfiles and assets but keeps source", () => {
    // Given a diff with a source file, a lockfile, and an image
    const diff = `diff --git a/apps/api/src/app.ts b/apps/api/src/app.ts
--- a/apps/api/src/app.ts
+++ b/apps/api/src/app.ts
@@ -1 +1 @@
+const a = 1;
diff --git a/bun.lock b/bun.lock
--- a/bun.lock
+++ b/bun.lock
@@ -1 +1 @@
+lock
diff --git a/assets/icon.png b/assets/icon.png
--- a/assets/icon.png
+++ b/assets/icon.png
Binary files differ`;

    // When the diff is filtered
    const filtered = filterDiff(diff);

    // Then only the source section remains
    expect(filtered.removedFiles).toBe(2);
    expect(filtered.diff).toContain("apps/api/src/app.ts");
    expect(filtered.diff).not.toContain("bun.lock");
    expect(filtered.diff).not.toContain("assets/icon.png");
  });
});
