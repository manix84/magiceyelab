import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mdiGrid } from "@mdi/js";
import { describe, expect, it, vi } from "vitest";
import { ToggleField } from "./ToggleField";

describe("ToggleField", () => {
  it("renders a labelled switch-style checkbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ToggleField
        checked={false}
        iconPath={mdiGrid}
        label="Show grid"
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByLabelText("Show grid");

    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
