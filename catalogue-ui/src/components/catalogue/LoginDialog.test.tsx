import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { LoginRequest } from "@/types";
import { LoginDialog } from "./LoginDialog";

const { login } = vi.hoisted(() => ({
  login: vi.fn<(body: LoginRequest) => Promise<{ email: string }>>(),
}));

vi.mock("@/api/auth", () => ({
  login,
  logout: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const theme = createAppTheme();

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  login.mockReset();
  login.mockResolvedValue({ email: "ada@example.com" });
});

const validPassword = "Abcd1!";

test("keeps sign in disabled until the identifier and password are valid", async () => {
  const screen = await render(<LoginDialog open onClose={vi.fn()} onRegister={vi.fn()} />, {
    wrapper: Providers,
  });

  const signIn = screen.getByRole("button", { name: "Sign in" });
  await expect.element(signIn).toBeDisabled();

  await screen.getByRole("textbox", { name: /email or username/i }).fill("ada@example.com");
  await expect.element(signIn).toBeDisabled();

  await screen.getByRole("textbox", { name: /password/i }).fill("secret");
  await expect.element(signIn).toBeDisabled();

  await screen.getByRole("textbox", { name: /password/i }).fill(validPassword);
  await expect.element(signIn).toBeEnabled();

  await screen.getByRole("textbox", { name: /email or username/i }).fill("   ");
  await expect.element(signIn).toBeDisabled();
  expect(login).not.toHaveBeenCalled();
});

test("signs in with the trimmed identifier and closes", async () => {
  const onClose = vi.fn();
  const screen = await render(<LoginDialog open onClose={onClose} onRegister={vi.fn()} />, {
    wrapper: Providers,
  });

  await screen.getByRole("textbox", { name: /email or username/i }).fill("  ada@example.com  ");
  await screen.getByRole("textbox", { name: /password/i }).fill(validPassword);
  await screen.getByRole("checkbox", { name: "Remember me" }).click();
  await screen.getByRole("button", { name: "Sign in" }).click();

  await expect.poll(() => login.mock.calls).toEqual([
    [{ email: "ada@example.com", password: validPassword, rememberMe: true }],
  ]);
  await expect.poll(() => onClose.mock.calls.length).toBe(1);
});

test("shows the sign-in error and stays open", async () => {
  login.mockRejectedValue(new Error("Unauthorized"));
  const onClose = vi.fn();
  const screen = await render(<LoginDialog open onClose={onClose} onRegister={vi.fn()} />, {
    wrapper: Providers,
  });

  await screen.getByRole("textbox", { name: /email or username/i }).fill("ada@example.com");
  await screen.getByRole("textbox", { name: /password/i }).fill(validPassword);
  await screen.getByRole("button", { name: "Sign in" }).click();

  const alert = screen.getByRole("alert");
  await expect.element(alert).toHaveTextContent("Email/username or password was incorrect");
  expect(onClose).not.toHaveBeenCalled();

  await screen.getByRole("textbox", { name: /email or username/i }).click();
  await expect.element(alert).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Sign in" }).click();
  await expect.element(screen.getByRole("alert")).toBeVisible();

  await screen.getByRole("textbox", { name: /password/i }).click();
  await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
});

test("shows that sign-in is in progress", async () => {
  let finishLogin: (value: { email: string }) => void = () => {};
  login.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishLogin = resolve;
      }),
  );
  const screen = await render(<LoginDialog open onClose={vi.fn()} onRegister={vi.fn()} />, {
    wrapper: Providers,
  });

  await screen.getByRole("textbox", { name: /email or username/i }).fill("ada@example.com");
  await screen.getByRole("textbox", { name: /password/i }).fill(validPassword);
  const submitted = screen.getByRole("button", { name: "Sign in" }).click();
  const pending = expect
    .element(screen.getByRole("button", { name: "Signing in…" }))
    .toBeDisabled();

  await Promise.race([submitted, pending]);
  await pending;
  finishLogin({ email: "ada@example.com" });
  await submitted;
});

test("opens registration and closes", async () => {
  const onClose = vi.fn();
  const onRegister = vi.fn();
  const screen = await render(<LoginDialog open onClose={onClose} onRegister={onRegister} />, {
    wrapper: Providers,
  });

  await expect.element(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await screen.getByRole("button", { name: "Create an account" }).click();
  await screen.getByRole("button", { name: "close" }).click();

  expect(onRegister).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});
