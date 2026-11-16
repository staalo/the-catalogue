import { describe, expect, it } from "vitest";
import { assertPasswordMeetsPolicy } from "../../src/modules/auth/passwordPolicy.js";

describe("passwordPolicy", () => {
  it("accepts a password that meets the password rules", () => {
    expect(() => assertPasswordMeetsPolicy("!Salasana1")).not.toThrow();
    expect(() => assertPasswordMeetsPolicy("Aa1!xx")).not.toThrow();
  });

  it("rejects passwords that miss the password rules", () => {
    expect(() => assertPasswordMeetsPolicy("Aa1!")).toThrow(
      /at least 6 characters/,
    );
    expect(() => assertPasswordMeetsPolicy("secret123")).toThrow(
      /non alphanumeric/,
    );
    expect(() => assertPasswordMeetsPolicy("Secret!!")).toThrow(
      /digit/,
    );
    expect(() => assertPasswordMeetsPolicy("SECRET1!")).toThrow(
      /lowercase/,
    );
    expect(() => assertPasswordMeetsPolicy("secret1!")).toThrow(
      /uppercase/,
    );
    expect(() => assertPasswordMeetsPolicy("SecretOne")).toThrow(
      /non alphanumeric/,
    );
  });
});
