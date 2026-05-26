import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { PageHeader } from "./PageHeader";

const meta = {
  component: PageHeader,
  tags: ["ai-generated"],
  args: {
    eyebrow: "Stereogram Generator",
    title: "Generate hidden-depth images",
    description:
      "Import a depth map and pattern tile, tune the render settings, then export the stereogram.",
  },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Generator: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Generate hidden-depth images" }),
    ).toBeVisible();
  },
};
