import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { CanvasPlaceholder } from "./CanvasPlaceholder";

const meta = {
  component: CanvasPlaceholder,
  tags: ["ai-generated"],
  args: {
    label: "Pattern tile",
  },
} satisfies Meta<typeof CanvasPlaceholder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = {};

export const Dark: Story = {
  args: {
    label: "Stereogram preview",
    tone: "dark",
  },
};

export const CssCheck: Story = {
  args: {
    label: "Stereogram preview",
    tone: "dark",
  },
  play: async ({ canvas }) => {
    await expect(
      getComputedStyle(canvas.getByText("Stereogram preview").parentElement!)
        .backgroundColor,
    ).toBe("rgb(23, 63, 67)");
  },
};
