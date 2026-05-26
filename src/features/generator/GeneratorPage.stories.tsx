import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { GeneratorPage } from "./GeneratorPage";

const meta = {
  component: GeneratorPage,
  tags: ["ai-generated"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof GeneratorPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Export PNG" }),
    ).toBeDisabled();
  },
};
