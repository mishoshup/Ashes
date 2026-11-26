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
    expect(filtered.deletedFiles).toBe(0);
    expect(filtered.diff).toContain("apps/api/src/app.ts");
    expect(filtered.diff).not.toContain("bun.lock");
    expect(filtered.diff).not.toContain("assets/icon.png");
  });

  it("collapses deleted files to a header without their hunks", () => {
    // Given a diff that deletes a source file with many removed lines
    const diff = `diff --git a/apps/mobile/src/old.ts b/apps/mobile/src/old.ts
deleted file mode 100644
index 1111111..0000000
--- a/apps/mobile/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-const old = 1;
-const gone = 2;
`;

    // When the diff is filtered
    const filtered = filterDiff(diff);

    // Then the file is still named, but its lines do not consume the review budget
    expect(filtered.deletedFiles).toBe(1);
    expect(filtered.removedFiles).toBe(0);
    expect(filtered.diff).toContain("apps/mobile/src/old.ts");
    expect(filtered.diff).toContain("deleted file");
    expect(filtered.diff).not.toContain("const old = 1");
  });
});
