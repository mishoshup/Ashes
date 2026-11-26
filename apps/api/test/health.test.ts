import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("health", () => {
  it("returns ok from D1", async () => {
    // Given a running Worker with a local D1 binding
    // When the health endpoint is fetched
    const response = await SELF.fetch("https://example.com/healthz");

    // Then it returns a healthy JSON payload
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      service: "ashes-api",
    });
  });
});
