import { describe, expect, it, vi } from "vitest";

const compareMock = vi.fn();
const findUserByEmailMock = vi.fn();
const findUserByIdMock = vi.fn();

vi.mock("bcrypt", () => ({
  default: {
    compare: compareMock,
  },
}));

vi.mock("../../src/infra/db/repositories/userRepository.js", () => ({
  findUserByEmail: findUserByEmailMock,
  findUserById: findUserByIdMock,
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
});
