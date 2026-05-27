import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { expect, userEvent } from "storybook/test";
import { PatternMakerPage } from "./PatternMakerPage";

const meta = {
  component: PatternMakerPage,
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
} satisfies Meta<typeof PatternMakerPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SeamlessTile: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Pattern painting tile")).toBeVisible();
    await expect(canvas.getByLabelText("Seamless pattern preview")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Fill" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Pick" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Brush size" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Brush opacity" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Brush flow" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Brush hardness" })).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Brush spacing" })).toBeVisible();
    await expect(canvas.queryByRole("slider", { name: "Fill tolerance" })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Fill" }));
    await expect(canvas.getByRole("slider", { name: "Fill tolerance" })).toBeVisible();
    await expect(canvas.getByLabelText("Primary colour hex")).toBeVisible();
    await expect(canvas.getByLabelText("Secondary colour hex")).toBeVisible();
    await expect(canvas.getByLabelText("Show grid")).toBeChecked();
    await expect(canvas.getByLabelText("Show boundary")).toBeChecked();
    await expect(canvas.getByRole("button", { name: "Import PNG" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Export PNG" })).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Random pattern" }));
    await expect(canvas.getByRole("button", { name: "Random pattern" })).toBeVisible();
  },
};
