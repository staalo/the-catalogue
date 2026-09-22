import bcrypt from "bcrypt";
import {
  createUser,
  findUserByEmail,
  findUserByEmailOrUserName,
  findUserById,
  isUniqueConstraintError,
} from "../../infra/db/repositories/userRepository.js";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../../shared/errors/AppError.js";
import { assertPasswordMeetsIdentityRules } from "./passwordPolicy.js";

export interface AuthUser {
  id: string;
  email: string;
  userName: string;
}

export type RegisteredUser = AuthUser;

export interface RegisterUserInput {
  email: string;
  password: string;
  userName?: string | undefined;
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
 * Create a new account. Media roots are deployment-level configuration and
 * are shared by every account.
 */
export async function registerUser(
  input: RegisterUserInput,
): Promise<RegisteredUser> {
  const email = input.email.trim();
  const userName = (input.userName?.trim() || email);

  if (!email || !input.password) {
    throw new BadRequestError("email and password are required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError("email is invalid");
  }

  assertPasswordMeetsIdentityRules(input.password);

  if (findUserByEmailOrUserName(email, userName)) {
    throw new ConflictError(
      "An account with this email or user name already exists",
    );
  }

  try {
    const user = await createUser({
      userName,
      email,
      password: input.password,
    });

    return {
      id: user.id,
      email: user.email ?? email,
      userName: user.userName,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        "An account with this email or user name already exists",
      );
    }
    throw error;
  }
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
