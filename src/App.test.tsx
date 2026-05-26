import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    const storage = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });

    document.documentElement.removeAttribute("data-theme");
  });

  it("redirects the root route to the generator", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Generate hidden-depth images" }),
    ).toBeInTheDocument();
  });

  it("renders the depth painter route", () => {
    render(
      <MemoryRouter initialEntries={["/depth-painter"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Paint monochrome depth maps" }),
    ).toBeInTheDocument();
  });

  it("defaults theme mode to auto and can switch to explicit themes", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/generator"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Use auto theme" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    await user.click(screen.getByRole("button", { name: "Use dark theme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("magiceyelab-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Use auto theme" }));

    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(window.localStorage.getItem("magiceyelab-theme")).toBeNull();
  });
});
