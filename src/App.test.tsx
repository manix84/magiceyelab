import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
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
});
