import type { ComponentProps, ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import { AppHeader } from "./AppHeader";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

function headerProps(
  overrides: Partial<ComponentProps<typeof AppHeader>> = {},
): ComponentProps<typeof AppHeader> {
  return {
    search: "",
    onSearchChange: vi.fn(),
    authenticated: false,
    authPending: false,
    onLogin: vi.fn(),
    onLogout: vi.fn(),
    onProfile: vi.fn(),
    ...overrides,
  };
}

beforeEach(async () => {
  await page.viewport(1280, 720);
});

test("offers login to a signed-out viewer", async () => {
  const props = headerProps();
  const screen = await render(<AppHeader {...props} />, { wrapper: ThemeWrapper });

  await expect.element(screen.getByText("catalogue")).toBeVisible();
  await expect.element(screen.getByText("A")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "open profile" })).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "log in" }).click();

  expect(props.onLogin).toHaveBeenCalledOnce();
  expect(props.onLogout).not.toHaveBeenCalled();
});

test("opens the profile and logs out for a signed-in viewer", async () => {
  const props = headerProps({
    authenticated: true,
    email: "bea@example.com",
    userName: "cleo",
  });
  const screen = await render(<AppHeader {...props} />, { wrapper: ThemeWrapper });

  const profile = screen.getByRole("button", { name: "open profile" });
  await expect.element(profile).toHaveTextContent("B");
  await expect.element(screen.getByRole("button", { name: "log in" })).not.toBeInTheDocument();

  await profile.click();
  await screen.getByRole("button", { name: "log out" }).click();

  expect(props.onProfile).toHaveBeenCalledOnce();
  expect(props.onLogout).toHaveBeenCalledOnce();
});

test("hides account actions while authentication is pending", async () => {
  const screen = await render(
    <AppHeader {...headerProps({ authenticated: true, authPending: true, email: "bea@example.com" })} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("button", { name: "log in" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "log out" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "open profile" })).not.toBeInTheDocument();
});

test("publishes search text after a short pause", async () => {
  const onSearchChange = vi.fn();
  const screen = await render(<AppHeader {...headerProps({ onSearchChange })} />, {
    wrapper: ThemeWrapper,
  });

  await screen.getByPlaceholder("Search your library").fill("dune");

  expect(onSearchChange).not.toHaveBeenCalled();
  await expect.poll(() => onSearchChange.mock.calls).toEqual([["dune"]]);
});

test("clears the search immediately", async () => {
  const onSearchChange = vi.fn();
  const screen = await render(<AppHeader {...headerProps({ search: "dune", onSearchChange })} />, {
    wrapper: ThemeWrapper,
  });

  await screen.getByPlaceholder("Search your library").fill("arrival");
  await screen.getByRole("button", { name: "clear search" }).click();

  await expect.element(screen.getByPlaceholder("Search your library")).toHaveValue("");
  await expect.element(screen.getByRole("button", { name: "clear search" })).not.toBeInTheDocument();
  expect(onSearchChange).toHaveBeenLastCalledWith("");

  const published = onSearchChange.mock.calls.length;
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });
  expect(onSearchChange.mock.calls).toHaveLength(published);
  expect(onSearchChange).toHaveBeenLastCalledWith("");
});
