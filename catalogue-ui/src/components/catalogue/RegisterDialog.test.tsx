import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { RegisterRequest, RegisterResponse } from "@/types";
import { RegisterDialog } from "./RegisterDialog";

const { register } = vi.hoisted(() => ({
  register: vi.fn<(body: RegisterRequest) => Promise<RegisterResponse>>(),
}));

vi.mock("@/api/auth", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register,
  getCurrentUser: vi.fn(),
}));

const theme = createAppTheme();
const passwordHint = "At least 6 characters, with uppercase, lowercase, a number, and a symbol.";

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
  register.mockReset();
  register.mockResolvedValue({ email: "ada@example.com", userName: "ada" });
});

async function fillAccount(
  screen: Awaited<ReturnType<typeof render>>,
  userName?: string,
) {
  await screen.getByRole("textbox", { name: /^email/i }).fill("  ada@example.com  ");
  await screen.getByRole("textbox", { name: /password/i }).fill("Abcd1!");
  if (userName !== undefined) {
    await screen.getByRole("textbox", { name: /username/i }).fill(userName);
  }
}

test("keeps create account disabled until the email and password are valid", async () => {
  const screen = await render(<RegisterDialog open onClose={vi.fn()} onLogin={vi.fn()} />, {
    wrapper: Providers,
  });

  const createAccount = screen.getByRole("button", { name: "Create account" });
  const email = screen.getByRole("textbox", { name: /^email/i });
  await expect.element(createAccount).toBeDisabled();

  await email.fill("ada");
  await expect.element(screen.getByText("Enter a valid email")).toBeVisible();
  await expect.element(createAccount).toBeDisabled();

  await email.fill("");
  await expect.element(screen.getByText("Email is required")).toBeVisible();
  await expect.element(createAccount).toBeDisabled();

  await email.fill("ada@example.com");
  await expect.element(createAccount).toBeDisabled();

  await screen.getByRole("textbox", { name: /password/i }).fill("Ab1!");
  await expect.element(createAccount).toBeDisabled();

  await screen.getByRole("textbox", { name: /password/i }).fill("Abcd1!");
  await expect.element(createAccount).toBeEnabled();

  await email.fill("");
  await expect.element(createAccount).toBeDisabled();
  expect(register).not.toHaveBeenCalled();
});

test("explains what the password is missing", async () => {
  const screen = await render(<RegisterDialog open onClose={vi.fn()} onLogin={vi.fn()} />, {
    wrapper: Providers,
  });
  const password = screen.getByRole("textbox", { name: /password/i });

  await expect.element(screen.getByText(passwordHint)).toBeVisible();

  await password.fill("Ab1!");
  await expect.element(screen.getByText("Password must be at least 6 characters.")).toBeVisible();

  await password.fill("Abcde1");
  await expect.element(screen.getByText("Password must include a symbol.")).toBeVisible();

  await password.fill("Abcde!");
  await expect.element(screen.getByText("Password must include a number.")).toBeVisible();

  await password.fill("ABCD1!");
  await expect.element(screen.getByText("Password must include a lowercase letter.")).toBeVisible();

  await password.fill("abcd1!");
  await expect.element(screen.getByText("Password must include an uppercase letter.")).toBeVisible();

  await password.fill("Abcd1!");
  await expect.element(screen.getByText(passwordHint)).toBeVisible();
  await expect
    .element(screen.getByText("Password must include an uppercase letter."))
    .not.toBeInTheDocument();
});

test("creates an account without a username and closes", async () => {
  const onClose = vi.fn();
  const screen = await render(<RegisterDialog open onClose={onClose} onLogin={vi.fn()} />, {
    wrapper: Providers,
  });

  await expect.element(screen.getByText("Optional")).toBeVisible();
  await fillAccount(screen, "   ");
  await screen.getByRole("button", { name: "Create account" }).click();

  await expect.poll(() => register.mock.calls).toEqual([
    [{ email: "ada@example.com", password: "Abcd1!", userName: undefined }],
  ]);
  await expect.poll(() => onClose.mock.calls.length).toBe(1);
});

test("creates an account with a username", async () => {
  const screen = await render(<RegisterDialog open onClose={vi.fn()} onLogin={vi.fn()} />, {
    wrapper: Providers,
  });

  await fillAccount(screen, "  Ada  ");
  await screen.getByRole("button", { name: "Create account" }).click();

  await expect.poll(() => register.mock.calls).toEqual([
    [{ email: "ada@example.com", password: "Abcd1!", userName: "Ada" }],
  ]);
});

test("shows the registration error and stays open", async () => {
  register.mockRejectedValue(new Error("Email is already registered"));
  const onClose = vi.fn();
  const screen = await render(<RegisterDialog open onClose={onClose} onLogin={vi.fn()} />, {
    wrapper: Providers,
  });

  await fillAccount(screen);
  await screen.getByRole("button", { name: "Create account" }).click();

  await expect.element(screen.getByRole("alert")).toHaveTextContent("Email is already registered");
  expect(onClose).not.toHaveBeenCalled();
});

test("shows that account creation is in progress", async () => {
  let finishRegister: (value: RegisterResponse) => void = () => {};
  register.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishRegister = resolve;
      }),
  );
  const screen = await render(<RegisterDialog open onClose={vi.fn()} onLogin={vi.fn()} />, {
    wrapper: Providers,
  });

  await fillAccount(screen);
  const submitted = screen.getByRole("button", { name: "Create account" }).click();
  const pending = expect
    .element(screen.getByRole("button", { name: "Creating account…" }))
    .toBeDisabled();

  await Promise.race([submitted, pending]);
  await pending;
  finishRegister({ email: "ada@example.com", userName: "ada" });
  await submitted;
});

test("returns to sign in and closes", async () => {
  const onClose = vi.fn();
  const onLogin = vi.fn();
  const screen = await render(<RegisterDialog open onClose={onClose} onLogin={onLogin} />, {
    wrapper: Providers,
  });

  await expect.element(screen.getByRole("heading", { name: "Create an account" })).toBeVisible();
  await screen.getByRole("button", { name: "Sign in" }).click();
  await screen.getByRole("button", { name: "close" }).click();

  expect(onLogin).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});
