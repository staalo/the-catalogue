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

test("requires an identifier and a password", async () => {
  const screen = await render(<LoginDialog open onClose={vi.fn()} onRegister={vi.fn()} />, {
    wrapper: Providers,
  });

  await screen.getByRole("button", { name: "Sign in" }).click();

  await expect.element(screen.getByText("Email or username is required")).toBeVisible();
  await expect.element(screen.getByText("Password is required")).toBeVisible();

  await screen.getByRole("textbox", { name: /email or username/i }).fill("   ");
  await screen.getByRole("button", { name: "Sign in" }).click();

  await expect.element(screen.getByText("Email or username is required")).toBeVisible();
  expect(login).not.toHaveBeenCalled();
});

test("signs in with the trimmed identifier and closes", async () => {
  const onClose = vi.fn();
  const screen = await render(<LoginDialog open onClose={onClose} onRegister={vi.fn()} />, {
    wrapper: Providers,
  });

  await screen.getByRole("textbox", { name: /email or username/i }).fill("  ada@example.com  ");
  await screen.getByRole("textbox", { name: /password/i }).fill("secret");
  await screen.getByRole("checkbox", { name: "Remember me" }).click();
  await screen.getByRole("button", { name: "Sign in" }).click();

  await expect.poll(() => login.mock.calls).toEqual([
    [{ email: "ada@example.com", password: "secret", rememberMe: true }],
  ]);
  await expect.poll(() => onClose.mock.calls.length).toBe(1);
});

test("shows the sign-in error and stays open", async () => {
  login.mockRejectedValue(new Error("Incorrect password"));
  const onClose = vi.fn();
  const screen = await render(<LoginDialog open onClose={onClose} onRegister={vi.fn()} />, {
    wrapper: Providers,
  });

  await screen.getByRole("textbox", { name: /email or username/i }).fill("ada@example.com");
  await screen.getByRole("textbox", { name: /password/i }).fill("secret");
  await screen.getByRole("button", { name: "Sign in" }).click();

  await expect.element(screen.getByRole("alert")).toHaveTextContent("Incorrect password");
  expect(onClose).not.toHaveBeenCalled();
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
  await screen.getByRole("textbox", { name: /password/i }).fill("secret");
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
