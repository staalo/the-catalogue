import { eq, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../client.js";
import { users } from "../schema.js";

const userColumns = {
  id: users.id,
  userName: users.userName,
  email: users.email,
  passwordHash: users.passwordHash,
};

export interface User {
  id: string;
  userName: string;
  email: string | null;
  passwordHash: string | null;
}

export interface CreateUserInput {
  userName: string;
  email: string;
  password: string;
}

export type CreatedUser = Omit<User, "passwordHash">;

/** Find a user by email (case-insensitive via normalizedEmail). */
export function findUserByEmail(email: string): User | undefined {
  return db
    .select(userColumns)
    .from(users)
    .where(eq(users.normalizedEmail, email.toUpperCase()))
    .get();
}

/** Find a user by user name (case-insensitive via normalizedUserName). */
export function findUserByUserName(userName: string): User | undefined {
  return db
    .select(userColumns)
    .from(users)
    .where(eq(users.normalizedUserName, userName.toUpperCase()))
    .get();
}

/** Find a user whose email or user name already matches. */
export function findUserByEmailOrUserName(
  email: string,
  userName: string,
): User | undefined {
  return db
    .select(userColumns)
    .from(users)
    .where(
      or(
        eq(users.normalizedEmail, email.toUpperCase()),
        eq(users.normalizedUserName, userName.toUpperCase()),
      ),
    )
    .get();
}

/** Find a user by their primary key. */
export function findUserById(id: string): User | undefined {
  return db
    .select(userColumns)
    .from(users)
    .where(eq(users.id, id))
    .get();
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";

  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    /UNIQUE constraint failed/i.test(error.message)
  );
}

/**
 * Create a new user with a bcrypt-hashed password.
 */
export async function createUser(input: CreateUserInput): Promise<CreatedUser> {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);

  db.insert(users)
    .values({
      id,
      userName: input.userName,
      normalizedUserName: input.userName.toUpperCase(),
      email: input.email,
      normalizedEmail: input.email.toUpperCase(),
      passwordHash,
    })
    .run();

  return { id, userName: input.userName, email: input.email };
}
