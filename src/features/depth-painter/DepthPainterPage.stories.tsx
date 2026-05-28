import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { expect, userEvent } from "storybook/test";
import { DepthPainterPage } from "./DepthPainterPage";

const meta = {
  component: DepthPainterPage,
  tags: ["ai-generated"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof DepthPainterPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MonochromeCanvas: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Depth map painting canvas")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Brush" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Eraser" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Fill" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Size" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Opacity" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Depth value" })).toBeVisible();
    await expect(canvas.getByLabelText("Show grid")).toBeChecked();

    await userEvent.click(canvas.getByRole("button", { name: "Fill" }));
    await expect(canvas.getByRole("slider", { name: "Fill tolerance" })).toBeVisible();
    await expect(canvas.queryByRole("slider", { name: "Size" })).not.toBeInTheDocument();

    await expect(canvas.getByRole("button", { name: "Import depth map" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Export PNG" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Use in generator" })).toBeVisible();
  },
};
