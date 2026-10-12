export const PASSWORD_HINT =
  'At least 6 characters, with uppercase, lowercase, a number, and a symbol.';

export function getPasswordIssue(value: string): string | undefined {
  if (!value) {
    return PASSWORD_HINT;
  }
  if (value.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Password must include a symbol.';
  }
  if (!/\d/.test(value)) {
    return 'Password must include a number.';
  }
  if (!/[a-z]/.test(value)) {
    return 'Password must include a lowercase letter.';
  }
  if (!/[A-Z]/.test(value)) {
    return 'Password must include an uppercase letter.';
  }
  return undefined;
}

export function validatePassword(value: string): true | string {
  return getPasswordIssue(value) ?? true;
}
