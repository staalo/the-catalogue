import { describe, expect, it } from "vitest";
import { assertPasswordMeetsIdentityRules } from "../../src/modules/auth/passwordPolicy.js";

describe("passwordPolicy", () => {
  it("accepts a password that meets Identity defaults", () => {
    expect(() => assertPasswordMeetsIdentityRules("!Salasana1")).not.toThrow();
    expect(() => assertPasswordMeetsIdentityRules("Aa1!xx")).not.toThrow();
  });

  it("rejects passwords that miss Identity default rules", () => {
    expect(() => assertPasswordMeetsIdentityRules("Aa1!")).toThrow(
      /at least 6 characters/,
    );
    expect(() => assertPasswordMeetsIdentityRules("secret123")).toThrow(
      /non alphanumeric/,
    );
    expect(() => assertPasswordMeetsIdentityRules("Secret!!")).toThrow(
      /digit/,
    );
    expect(() => assertPasswordMeetsIdentityRules("SECRET1!")).toThrow(
      /lowercase/,
    );
    expect(() => assertPasswordMeetsIdentityRules("secret1!")).toThrow(
      /uppercase/,
    );
    expect(() => assertPasswordMeetsIdentityRules("SecretOne")).toThrow(
      /non alphanumeric/,
    );
  });
});
