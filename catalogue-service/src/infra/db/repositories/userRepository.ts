import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../client.js";
import { users } from "../schema.js";

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
    .select({
      id: users.id,
      userName: users.userName,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.normalizedEmail, email.toUpperCase()))
    .get();
}

/** Find a user by user name (case-insensitive via normalizedUserName). */
export function findUserByUserName(userName: string): User | undefined {
  return db
    .select({
      id: users.id,
      userName: users.userName,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.normalizedUserName, userName.toUpperCase()))
    .get();
}

/** Find a user by their primary key. */
export function findUserById(id: string): User | undefined {
  return db
    .select({
      id: users.id,
      userName: users.userName,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, id))
    .get();
}

/**
 * Create a new user with a bcrypt-hashed password.
 * NOTE: This service manages its own user records independently of the
 * .NET ASP.NET Identity tables. Existing .NET users must be re-created here.
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
