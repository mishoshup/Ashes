import { describe, expect, it } from "bun:test";

import { extractReportFromStderr, extractReportPath, isSafeReportPath } from "./report";

describe("Roast report extraction", () => {
  it("finds the report path printed after the run", () => {
    // Given stderr with a quoted report line before the real run summary
    const stderr =
      "report /tmp/fake.md\nprogress\nroast: run 20260101T000000Z-abc · report /tmp/report.md\n";

    // Then the last report path is extracted
    expect(extractReportPath(stderr)).toBe("/tmp/report.md");
  });

  it("extracts the markdown report when no path is printed", () => {
    // Given stderr with a markdown report after progress logs
    const stderr = "progress\n## Roast: 1 finding(s)\n\n### R-1\n";

    // Then the report starts at the heading
    expect(extractReportFromStderr(stderr)).toBe("## Roast: 1 finding(s)\n\n### R-1");
  });

  it("only accepts a report inside the Roast runs directory", () => {
    // Given the Roast runs root
    const root = "/home/runner/.local/share/roast/runs";

    // Then a run report is accepted and arbitrary paths are not
    expect(isSafeReportPath(`${root}/run-id/report.md`, root)).toBe(true);
    expect(isSafeReportPath("/etc/passwd", root)).toBe(false);
    expect(isSafeReportPath(`${root}/../secret/report.md`, root)).toBe(false);
  });

  it("returns an empty string when no report exists", () => {
    expect(extractReportFromStderr("progress only")).toBe("");
    expect(extractReportPath("progress only")).toBeNull();
  });
});
