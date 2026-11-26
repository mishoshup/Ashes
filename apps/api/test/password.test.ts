import { describe, expect, it } from "vitest";
import { verifyPassword } from "../src/services/password";

const FIXTURE =
  "$argon2id$v=19$m=19456,t=2,p=1$BwcHBwcHBwcHBwcHBwcHBw$7hQYzp7jSIoOhQhn/0Qpej2NS8Dmuh+J08pvwnajXZ8";
const PASSWORD = "correct horse battery staple";
const PEPPER = "reference-pepper-32-characters-long";

describe("password PHC", () => {
  it("verifies a fixed PHC fixture with the right pepper", async () => {
    // Given a fixed Argon2id PHC string produced with a known pepper
    // When it is verified with the same password and pepper
    const ok = await verifyPassword(PASSWORD, FIXTURE, PEPPER);
    const wrongPassword = await verifyPassword("wrong password", FIXTURE, PEPPER);
    const wrongPepper = await verifyPassword(
      PASSWORD,
      FIXTURE,
      "different-pepper-32-characters-long",
    );
    const emptyPepper = await verifyPassword(PASSWORD, FIXTURE, "");

    // Then only the matching password and pepper succeed
    expect(ok).toBe(true);
    expect(wrongPassword).toBe(false);
    expect(wrongPepper).toBe(false);
    expect(emptyPepper).toBe(false);
  });
});
