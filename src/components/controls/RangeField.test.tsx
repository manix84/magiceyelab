import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RangeField } from "./RangeField";

describe("RangeField", () => {
  it("renders the label, value, and slider", () => {
    const onChange = vi.fn();

    render(
      <RangeField
        label="Depth strength"
        min={0}
        max={100}
        value={45}
        valueLabel="45%"
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole("slider", { name: "Depth strength" });

    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(slider).toHaveValue("45");

    fireEvent.change(slider, { target: { value: "46" } });

    expect(onChange).toHaveBeenCalledWith(46);
  });

  it("uses an explicit accessible label when provided", () => {
    render(
      <RangeField
        ariaLabel="Brush opacity"
        label="Opacity"
        min={10}
        max={100}
        value={80}
        valueLabel="80%"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("slider", { name: "Brush opacity" })).toHaveValue("80");
  });
});
