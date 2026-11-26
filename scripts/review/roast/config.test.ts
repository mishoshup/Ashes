import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

import { writeRoastConfig } from "./config";

describe("Roast config", () => {
  it("writes both roles on the same Flash model with additive prompts", () => {
    // Given a temporary config directory
    const dir = mkdtempSync(join(tmpdir(), "ashes-roast-config-"));

    try {
      // When the config is written
      const path = writeRoastConfig({
        dir,
        finderPath: join(dir, "finder.md"),
        verifierPath: join(dir, "verifier.md"),
        baseUrl: "https://api.commandcode.ai/provider/v1",
        model: "deepseek/deepseek-v4.1-flash",
      });
      const body = readFileSync(path, "utf8");

      // Then both roles use the Flash profile and the generated prompts
      expect(body).toContain('model: "deepseek/deepseek-v4.1-flash"');
      expect(body).toContain("api_key_env: REVIEW_API_KEY");
      expect(body).toContain("finder_code:");
      expect(body).toContain("verifier:");
      expect(body).toContain("confidence_floor: 0.65");
      expect(body.match(/profile: commandcode/gu)).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
