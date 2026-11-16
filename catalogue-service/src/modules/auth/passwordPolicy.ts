import { BadRequestError } from "../../shared/errors/AppError.js";

/**
 * Password requirements: length, character classes, and a non-alphanumeric character.
 */
export const PASSWORD_OPTIONS = {
  requiredLength: 6,
  requiredUniqueChars: 1,
  requireNonAlphanumeric: true,
  requireLowercase: true,
  requireUppercase: true,
  requireDigit: true,
} as const;

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isLower(c: string): boolean {
  return c >= "a" && c <= "z";
}

function isUpper(c: string): boolean {
  return c >= "A" && c <= "Z";
}

function isLetterOrDigit(c: string): boolean {
  return isUpper(c) || isLower(c) || isDigit(c);
}

/**
 * Reject a password that misses the password requirements.
 * Throws BadRequestError listing every failed rule.
 */
export function assertPasswordMeetsPolicy(password: string): void {
  const options = PASSWORD_OPTIONS;
  const errors: string[] = [];
  const chars = [...password];

  if (password.length < options.requiredLength) {
    errors.push(
      `Passwords must be at least ${options.requiredLength} characters.`,
    );
  }
  if (options.requireNonAlphanumeric && chars.every(isLetterOrDigit)) {
    errors.push(
      "Passwords must have at least one non alphanumeric character.",
    );
  }
  if (options.requireDigit && !chars.some(isDigit)) {
    errors.push("Passwords must have at least one digit ('0'-'9').");
  }
  if (options.requireLowercase && !chars.some(isLower)) {
    errors.push("Passwords must have at least one lowercase ('a'-'z').");
  }
  if (options.requireUppercase && !chars.some(isUpper)) {
    errors.push("Passwords must have at least one uppercase ('A'-'Z').");
  }
  if (
    options.requiredUniqueChars >= 1 &&
    new Set(chars).size < options.requiredUniqueChars
  ) {
    errors.push(
      `Passwords must use at least ${options.requiredUniqueChars} different characters.`,
    );
  }

  if (errors.length > 0) {
    throw new BadRequestError(errors.join(" "));
  }
}
