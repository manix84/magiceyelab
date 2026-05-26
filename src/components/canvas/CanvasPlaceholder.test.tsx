import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasPlaceholder } from "./CanvasPlaceholder";

describe("CanvasPlaceholder", () => {
  it("renders the supplied label", () => {
    render(<CanvasPlaceholder label="Pattern tile" />);

    expect(screen.getByText("Pattern tile")).toBeInTheDocument();
  });
});
