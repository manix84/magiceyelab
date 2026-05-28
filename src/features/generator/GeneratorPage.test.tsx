import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeneratorPage } from "./GeneratorPage";

describe("GeneratorPage", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders disabled export state until images are imported", () => {
    render(<GeneratorPage />);

    expect(screen.getByRole("button", { name: "Export PNG" })).toBeDisabled();
    expect(
      screen.getByText("Import a depth map and pattern to generate a preview"),
    ).toBeInTheDocument();
  });

  it("shows animation speed controls only when animation is enabled", async () => {
    const user = userEvent.setup();

    render(<GeneratorPage />);

    expect(screen.queryByRole("slider", { name: "Animation speed" })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Animate preview"));

    expect(screen.getByRole("slider", { name: "Animation speed" })).toHaveValue("32");
  });

  it("restores stored render and animation controls", () => {
    storage.set(
      "magiceyelab:generator",
      JSON.stringify({
        version: 1,
        exportName: "saved.png",
        depthStrength: 66,
        repeatWidth: 144,
        animationEnabled: true,
        animationSpeed: 72,
        showDepthOverlay: true,
        depthFileName: "",
        depthInferenceMessage: "",
        depthImageDataUrl: "",
        patternFileName: "",
        patternImageDataUrl: "",
      }),
    );

    render(<GeneratorPage />);

    expect(screen.getByLabelText("Export name")).toHaveValue("saved.png");
    expect(screen.getByRole("slider", { name: "Depth strength" })).toHaveValue("66");
    expect(screen.getByRole("slider", { name: "Repeat width" })).toHaveValue("144");
    expect(screen.getByLabelText("Animate preview")).toBeChecked();
    expect(screen.getByRole("slider", { name: "Animation speed" })).toHaveValue("72");
    expect(screen.getByLabelText("Show depth overlay")).toBeChecked();
  });
});
