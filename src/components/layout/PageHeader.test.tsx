import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the page copy", () => {
    render(
      <PageHeader
        eyebrow="Generator"
        title="Generate hidden-depth images"
        description="Import a depth map and pattern tile."
      />,
    );

    expect(screen.getByText("Generator")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Generate hidden-depth images" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Import a depth map and pattern tile."),
    ).toBeInTheDocument();
  });
});
