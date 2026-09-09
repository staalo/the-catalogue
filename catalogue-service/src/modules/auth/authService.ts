import bcrypt from "bcrypt";
import {
  findUserByEmail,
  findUserById,
} from "../../infra/db/repositories/userRepository.js";
import { UnauthorizedError } from "../../shared/errors/AppError.js";

export interface AuthUser {
  id: string;
  email: string;
  userName: string;
}

/**
 * Validate credentials and return the authenticated user.
 * Mirrors .NET: FindByEmailAsync + PasswordSignInAsync.
 * Throws UnauthorizedError on any failure — intentionally no detail leak.
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<AuthUser> {
  const user = findUserByEmail(email);

  if (!user || !user.passwordHash) {
    // Constant-time dummy comparison to prevent timing-based user enumeration
    await bcrypt.compare(
      password,
      "$2b$12$invalidhashpadding000000000000000000000000000000000000000",
    );
    throw new UnauthorizedError();
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError();
  }

  return { id: user.id, email: user.email ?? email, userName: user.userName };
}

/**
 * Resolve an authenticated session back to a user summary.
 * Returns null if the session references a deleted user.
 */
export function resolveSession(userId: string): AuthUser | null {
  const user = findUserById(userId);
  if (!user) return null;
  return { id: user.id, email: user.email ?? "", userName: user.userName };
}
