import { describe, expect, it } from "bun:test";

import { composeFinderPrompt, composeVerifierPrompt, loadAshesRules } from "./prompts";

describe("Roast prompt composition", () => {
  it("appends rules without replacing the finder core", () => {
    // Given a core prompt and a rules digest
    // When the finder prompt is composed
    const prompt = composeFinderPrompt("CORE", "RULE");

    // Then the core is first and the rules are additive
    expect(prompt.startsWith("CORE")).toBe(true);
    expect(prompt).toContain("RULE");
    expect(prompt).toContain("Additional Ashes review rules");
    expect(prompt).toContain("style");
  });

  it("appends rules to the verifier and keeps its procedure", () => {
    // Given a verifier core and a rules digest
    // When the verifier prompt is composed
    const prompt = composeVerifierPrompt("VERIFIER", "RULE");

    // Then the core is first and style claims are explicitly in scope
    expect(prompt.startsWith("VERIFIER")).toBe(true);
    expect(prompt).toContain("RULE");
    expect(prompt).toContain("Do not refute a style claim");
  });

  it("refuses working-tree rules in CI", async () => {
    // Given a base that does not contain the rules
    // Then CI rules loading fails instead of falling back
    let error: unknown;
    try {
      await loadAshesRules("refs/heads/does-not-exist", { shouldAllowWorktreeRules: false });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
  });

  it("falls back to working-tree rules locally", async () => {
    // Given a base that does not contain the rules
    // When local rules loading is allowed
    const rules = await loadAshesRules("refs/heads/does-not-exist", {
      shouldAllowWorktreeRules: true,
    });

    // Then the working-tree rules are used
    expect(rules).toContain("PRODUCT-1");
  });
});
