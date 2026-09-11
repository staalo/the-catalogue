import bcrypt from "bcrypt";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUserName,
} from "../../infra/db/repositories/userRepository.js";
import { upsertMediaPaths } from "../../infra/db/repositories/localMediaRepository.js";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../../shared/errors/AppError.js";
import { resolveExistingDirectory } from "../media-paths/mediaPathService.js";
import { assertPasswordMeetsIdentityRules } from "./passwordPolicy.js";

export interface AuthUser {
  id: string;
  email: string;
  userName: string;
}

export interface RegisteredUser extends AuthUser {
  moviesPath: string | null;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  userName?: string | undefined;
  moviesPath?: string | undefined;
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
 * Create a new account and an empty media-paths row.
 * moviesPath is optional and can be set later via PUT /api/media/paths.
 */
export async function registerUser(
  input: RegisterUserInput,
): Promise<RegisteredUser> {
  const email = input.email.trim();
  const userName = (input.userName?.trim() || email);
  const moviesPathInput = input.moviesPath?.trim() || undefined;

  if (!email || !input.password) {
    throw new BadRequestError("email and password are required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError("email is invalid");
  }

  assertPasswordMeetsIdentityRules(input.password);

  if (findUserByEmail(email) || findUserByUserName(userName)) {
    throw new ConflictError("An account with this email or user name already exists");
  }

  const moviesPath = moviesPathInput
    ? await resolveExistingDirectory(moviesPathInput)
    : null;

  const user = await createUser({
    userName,
    email,
    password: input.password,
  });

  upsertMediaPaths(user.userName, { moviesPath, tvPath: null });

  return {
    id: user.id,
    email: user.email ?? email,
    userName: user.userName,
    moviesPath,
  };
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
