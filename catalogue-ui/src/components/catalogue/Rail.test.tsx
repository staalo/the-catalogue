import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { Media } from "@/types";
import { Rail } from "./Rail";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

function media(id: number, title: string): Media {
  return {
    id,
    title,
    type: "movie",
    year: "2021",
    meta: "2h 35m",
    image: `/${id}.jpg`,
    backdrop: `/${id}-backdrop.jpg`,
    description: "A story.",
    genres: [],
  };
}

test("renders nothing when there are no items", async () => {
  const screen = await render(<Rail title="Continue watching" items={[]} onOpen={vi.fn()} />, {
    wrapper: ThemeWrapper,
  });

  await expect
    .element(screen.getByRole("heading", { name: "Continue watching" }))
    .not.toBeInTheDocument();
});

test("opens a poster from the rail", async () => {
  const dune = media(1, "Dune");
  const arrival = media(2, "Arrival");
  const onOpen = vi.fn();
  const screen = await render(
    <Rail title="All movies (2)" items={[dune, arrival]} onOpen={onOpen} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("heading", { name: "All movies (2)" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /dune/i })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /arrival/i })).toBeVisible();

  await screen.getByRole("button", { name: /arrival/i }).click();

  expect(onOpen).toHaveBeenCalledOnce();
  expect(onOpen).toHaveBeenCalledWith(arrival);
});

test("scrolls the posters when they overflow", async () => {
  await page.viewport(360, 800);

  try {
    const items = Array.from({ length: 8 }, (_, index) => media(index + 1, `Title ${index + 1}`));
    const screen = await render(<Rail title="All movies" items={items} onOpen={vi.fn()} />, {
      wrapper: ThemeWrapper,
    });

    const scrollLeft = screen.getByRole("button", { name: "scroll left" });
    const scrollRight = screen.getByRole("button", { name: "scroll right" });
    await expect.element(scrollLeft).toBeDisabled();
    await expect.element(scrollRight).toBeEnabled();

    await scrollRight.click();

    const scroller = screen.getByRole("button", { name: /title 1/i }).element().parentElement;
    await expect.poll(() => scroller?.scrollLeft ?? 0).toBeGreaterThan(1);
    await expect.element(scrollLeft).toBeEnabled();
  } finally {
    await page.viewport(1280, 720);
  }
});
