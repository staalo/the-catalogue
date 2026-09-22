import { describe, expect, it, vi } from "vitest";

const compareMock = vi.fn();
const findUserByEmailMock = vi.fn();
const findUserByIdMock = vi.fn();
const findUserByEmailOrUserNameMock = vi.fn();
const createUserMock = vi.fn();

vi.mock("bcrypt", () => ({
  default: {
    compare: compareMock,
  },
}));

vi.mock("../../src/infra/db/repositories/userRepository.js", () => ({
  findUserByEmail: findUserByEmailMock,
  findUserById: findUserByIdMock,
  findUserByEmailOrUserName: findUserByEmailOrUserNameMock,
  createUser: createUserMock,
  isUniqueConstraintError: (error: unknown) => {
    if (!(error instanceof Error)) {
      return false;
    }
    const code =
      "code" in error && typeof error.code === "string" ? error.code : "";
    return (
      code === "SQLITE_CONSTRAINT_UNIQUE" ||
      /UNIQUE constraint failed/i.test(error.message)
    );
  },
}));

describe("authService", () => {
  it("throws UnauthorizedError and performs dummy compare when user is missing", async () => {
    findUserByEmailMock.mockReturnValueOnce(undefined);
    compareMock.mockResolvedValueOnce(false);

    const { loginUser } = await import("../../src/modules/auth/authService.js");

    await expect(loginUser("missing@example.com", "pw")).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(compareMock).toHaveBeenCalledTimes(1);
  });

  it("throws UnauthorizedError for wrong password", async () => {
    findUserByEmailMock.mockReturnValueOnce({
      id: "u-1",
      userName: "alice",
      email: "alice@example.com",
      passwordHash: "$2b$12$realhashrealhashrealhashrealhashrealhashrealhash",
    });
    compareMock.mockResolvedValueOnce(false);

    const { loginUser } = await import("../../src/modules/auth/authService.js");

    await expect(loginUser("alice@example.com", "wrong")).rejects.toMatchObject(
      { statusCode: 401 },
    );
  });

  it("returns authenticated user for valid credentials", async () => {
    findUserByEmailMock.mockReturnValueOnce({
      id: "u-2",
      userName: "bob",
      email: "bob@example.com",
      passwordHash: "$2b$12$realhashrealhashrealhashrealhashrealhashrealhash",
    });
    compareMock.mockResolvedValueOnce(true);

    const { loginUser } = await import("../../src/modules/auth/authService.js");

    await expect(loginUser("bob@example.com", "ok")).resolves.toEqual({
      id: "u-2",
      email: "bob@example.com",
      userName: "bob",
    });
  });

  it("resolves session to user summary and returns null for missing users", async () => {
    const { resolveSession } =
      await import("../../src/modules/auth/authService.js");

    findUserByIdMock.mockReturnValueOnce(undefined);
    expect(resolveSession("missing")).toBeNull();

    findUserByIdMock.mockReturnValueOnce({
      id: "u-3",
      userName: "carol",
      email: "carol@example.com",
      passwordHash: null,
    });
    expect(resolveSession("u-3")).toEqual({
      id: "u-3",
      email: "carol@example.com",
      userName: "carol",
    });
  });

  it("registers a user using email as the default username", async () => {
    findUserByEmailOrUserNameMock.mockReturnValueOnce(undefined);
    createUserMock.mockResolvedValueOnce({
      id: "u-new",
      userName: "new@example.com",
      email: "new@example.com",
    });
    const { registerUser } =
      await import("../../src/modules/auth/authService.js");
    const result = await registerUser({
      email: "new@example.com",
      password: "!Salasana1",
    });

    expect(result).toEqual({
      id: "u-new",
      email: "new@example.com",
      userName: "new@example.com",
    });
    expect(findUserByEmailOrUserNameMock).toHaveBeenCalledWith(
      "new@example.com",
      "new@example.com",
    );
  });

  it("registers a user with an optional username", async () => {
    findUserByEmailOrUserNameMock.mockReturnValueOnce(undefined);
    createUserMock.mockResolvedValueOnce({
      id: "u-path",
      userName: "alice",
      email: "alice@example.com",
    });

    const { registerUser } =
      await import("../../src/modules/auth/authService.js");
    const result = await registerUser({
      email: "alice@example.com",
      password: "!Salasana1",
      userName: "alice",
    });

    expect(result).toEqual({
      id: "u-path",
      email: "alice@example.com",
      userName: "alice",
    });
  });

  it("rejects passwords that do not meet Identity rules and duplicate accounts", async () => {
    const { registerUser } =
      await import("../../src/modules/auth/authService.js");

    await expect(
      registerUser({ email: "a@b.c", password: "short" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      registerUser({ email: "a@b.c", password: "secret123" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    findUserByEmailOrUserNameMock.mockReturnValueOnce({
      id: "u-1",
      userName: "taken",
      email: "taken@example.com",
      passwordHash: "hash",
    });
    await expect(
      registerUser({
        email: "taken@example.com",
        password: "!Salasana1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("maps a unique-constraint race on insert to ConflictError", async () => {
    findUserByEmailOrUserNameMock.mockReturnValueOnce(undefined);
    const uniqueError = Object.assign(new Error("UNIQUE constraint failed: users.normalized_email"), {
      code: "SQLITE_CONSTRAINT_UNIQUE",
    });
    createUserMock.mockRejectedValueOnce(uniqueError);

    const { registerUser } =
      await import("../../src/modules/auth/authService.js");

    await expect(
      registerUser({
        email: "race@example.com",
        password: "!Salasana1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
