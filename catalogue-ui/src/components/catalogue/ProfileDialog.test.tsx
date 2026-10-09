import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import { ProfileDialog } from "./ProfileDialog";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

test("shows the account details and closes", async () => {
  const onClose = vi.fn();
  const screen = await render(
    <ProfileDialog
      open
      email="ada@example.com"
      userName="ada"
      onClose={onClose}
    />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("dialog")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Your profile" })).toBeVisible();
  await expect.element(screen.getByText("Account details for this library.")).toBeVisible();

  const email = screen.getByRole("textbox", { name: "Email" });
  const userName = screen.getByRole("textbox", { name: "Username" });
  await expect.element(email).toHaveValue("ada@example.com");
  await expect.element(email).toBeDisabled();
  await expect.element(userName).toHaveValue("ada");
  await expect.element(userName).toBeDisabled();

  await screen.getByRole("button", { name: "close" }).click();

  expect(onClose).toHaveBeenCalledOnce();
});
