import { describe, expect, it } from "bun:test";
import { parseReviewJson } from "./parse";
import { validateFindings } from "./validate";

const diff = `diff --git a/apps/api/src/app.ts b/apps/api/src/app.ts
index 111..222 100644
--- a/apps/api/src/app.ts
+++ b/apps/api/src/app.ts
@@ -10,2 +10,3 @@
 const app = new Hono();
+app.get("/x", (c) => c.json({ok: true}));
 app.route("/api", routes);
`;

const base = {
  verdict: "approve" as const,
  summary: "Looks fine.",
  findings: [],
};

describe("parseReviewJson", () => {
  it("parses plain and fenced JSON", () => {
    expect(parseReviewJson('{"ok":true}')).toEqual({ ok: true });
    expect(parseReviewJson('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });
});

describe("validateFindings", () => {
  it("keeps findings with changed paths and diff evidence", () => {
    // Given a finding whose path and evidence are on an added line
    // When the review is validated
    const result = validateFindings(diff, {
      ...base,
      findings: [
        {
          severity: "high",
          ruleId: "API-9",
          path: "apps/api/src/app.ts",
          line: 11,
          evidence: 'app.get("/x", (c) => c.json({ok: true}));',
          why: "Missing validation.",
          fix: "Parse with Zod.",
        },
      ],
    });
    expect(result.result.findings).toHaveLength(1);
    expect(result.dropped).toBe(0);
    expect(result.blocking).toBe(true);
    expect(result.result.verdict).toBe("request_changes");
  });

  it("drops findings with wrong paths, missing evidence, or duplicates", () => {
    // Given four findings: valid, duplicate, wrong path, and wrong evidence
    const finding = {
      severity: "medium" as const,
      ruleId: "API-2",
      path: "apps/api/src/app.ts",
      line: 11,
      evidence: 'app.get("/x", (c) => c.json({ok: true}));',
      why: "Wrong middleware order.",
      fix: "Move middleware.",
    };
    const result = validateFindings(diff, {
      ...base,
      findings: [
        finding,
        finding,
        { ...finding, path: "apps/api/src/other.ts" },
        { ...finding, evidence: "not in the diff" },
      ],
    });
    expect(result.result.findings).toHaveLength(1);
    expect(result.dropped).toBe(3);
    expect(result.blocking).toBe(false);
  });

  it("rejects context, removed, and wrong-line evidence", () => {
    // Given a diff with one context line, one removed line, and one added line
    const mixed = `diff --git a/apps/api/src/app.ts b/apps/api/src/app.ts
index 111..222 100644
--- a/apps/api/src/app.ts
+++ b/apps/api/src/app.ts
@@ -10,2 +10,3 @@
 const app = new Hono();
-const removed = 1;
+const added = 2;
`;
    const finding = {
      severity: "high" as const,
      ruleId: "API-2",
      path: "apps/api/src/app.ts",
      line: 10,
      evidence: "const app = new Hono();",
      why: "Context line.",
      fix: "N/A",
    };

    // When findings point at context, removed, wrong-line, and added lines
    const result = validateFindings(mixed, {
      ...base,
      findings: [
        finding,
        { ...finding, line: 11, evidence: "const removed = 1;" },
        { ...finding, line: 12, evidence: "const added = 2;" },
        { ...finding, line: 11, evidence: "const added = 2;" },
      ],
    });

    // Then only the added-line finding survives
    expect(result.result.findings).toHaveLength(1);
    expect(result.result.findings[0]?.evidence).toBe("const added = 2;");
    expect(result.dropped).toBe(3);
  });

  it("does not block on low or medium findings", () => {
    // Given a low-severity finding on an added line
    // When the review is validated
    const result = validateFindings(diff, {
      ...base,
      findings: [
        {
          severity: "low",
          ruleId: "TEST-1",
          path: "apps/api/src/app.ts",
          line: 11,
          evidence: 'app.get("/x", (c) => c.json({ok: true}));',
          why: "No test.",
          fix: "Add a test.",
        },
      ],
    });
    expect(result.blocking).toBe(false);
    expect(result.result.verdict).toBe("approve");
  });
});
