import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatternMakerPage } from "./PatternMakerPage";

function createCanvasContextMock() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    clearRect: vi.fn(),
    createPattern: vi.fn(() => ({})),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn((...args: number[]) => {
      const width = args[2] ?? 1;
      const height = args[3] ?? 1;

      return {
      data: new Uint8ClampedArray(width * height * 4),
      height,
      width,
      };
    }),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    putImageData: vi.fn(),
    stroke: vi.fn(),
    set fillStyle(_value: unknown) {},
    set lineCap(_value: unknown) {},
    set lineJoin(_value: unknown) {},
    set lineWidth(_value: unknown) {},
    set globalAlpha(_value: unknown) {},
    set strokeStyle(_value: unknown) {},
    canvas: document.createElement("canvas"),
  };
}

function renderPatternMakerPage() {
  return render(
    <MemoryRouter>
      <PatternMakerPage />
    </MemoryRouter>,
  );
}

describe("PatternMakerPage", () => {
  let context: ReturnType<typeof createCanvasContextMock>;
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let toDataUrlSpy: ReturnType<typeof vi.spyOn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let storage: Map<string, string>;
  let setItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    context = createCanvasContextMock();
    storage = new Map<string, string>();
    setItemSpy = vi.fn((key: string, value: string) => {
      storage.set(key, value);
    });
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,pattern");
    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: setItemSpy,
      },
    });
  });

  afterEach(() => {
    cleanup();
    anchorClickSpy.mockRestore();
    getContextSpy.mockRestore();
    toDataUrlSpy.mockRestore();
  });

  it("renders the paint tile and repeat preview canvases", () => {
    renderPatternMakerPage();

    expect(screen.getByLabelText("Pattern painting tile")).toBeInTheDocument();
    expect(screen.getByLabelText("Seamless pattern preview")).toBeInTheDocument();
  });

  it("generates wrapped motifs for random patterns", async () => {
    const user = userEvent.setup();
    renderPatternMakerPage();

    await user.click(screen.getByRole("button", { name: "Random pattern" }));

    expect(context.stroke).toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalled();
    expect(context.createPattern).toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalled();
  });

  it("supports pencil, brush settings, display toggles, and history controls", async () => {
    const user = userEvent.setup();
    renderPatternMakerPage();

    await user.click(screen.getByRole("button", { name: "Pencil" }));
    await user.click(screen.getByRole("button", { name: "Square" }));
    await user.click(screen.getByRole("button", { name: "Global" }));
    await user.click(screen.getByLabelText("Show grid"));
    await user.click(screen.getByLabelText("Show boundary"));

    expect(screen.getByRole("button", { name: "Pencil" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("slider", { name: "Brush size" })).toHaveValue("36");
    expect(screen.getByRole("slider", { name: "Brush opacity" })).toHaveValue("100");
    expect(screen.getByRole("slider", { name: "Fill tolerance" })).toHaveValue("8");
    expect(screen.getByRole("button", { name: "Square" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Global" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Show grid")).not.toBeChecked();
    expect(screen.getByLabelText("Show boundary")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("supports keyboard shortcuts for undo and redo", async () => {
    const user = userEvent.setup();
    renderPatternMakerPage();

    await user.click(screen.getByRole("button", { name: "Random pattern" }));

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(context.putImageData).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(context.putImageData).toHaveBeenCalledTimes(2);
  });

  it("supports tool keyboard shortcuts", () => {
    renderPatternMakerPage();

    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByRole("button", { name: "Pencil" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(window, { key: "e" });
    expect(screen.getByRole("button", { name: "Eraser" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(window, { key: "i" });
    expect(screen.getByRole("button", { name: "Pick" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(window, { key: "f" });
    expect(screen.getByRole("button", { name: "Fill" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(window, { key: "b" });
    expect(screen.getByRole("button", { name: "Brush" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("exports and clears the pattern tile", async () => {
    const user = userEvent.setup();
    renderPatternMakerPage();

    await user.click(screen.getByRole("button", { name: "Export PNG" }));
    expect(toDataUrlSpy).toHaveBeenCalledWith("image/png");

    await user.click(screen.getByRole("button", { name: "Clear tile" }));
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
  });

  it("supports hex colour entry and recent colours", async () => {
    const user = userEvent.setup();
    renderPatternMakerPage();

    await user.clear(screen.getByLabelText("Current colour hex"));
    await user.type(screen.getByLabelText("Current colour hex"), "#abcdef");

    expect(screen.getByLabelText("Current colour hex")).toHaveValue("#abcdef");
    expect(screen.getByLabelText("Select recent #abcdef")).toBeInTheDocument();
  });

  it("saves the current tile as the generator pattern", async () => {
    const user = userEvent.setup();

    renderPatternMakerPage();

    await user.click(screen.getByRole("button", { name: "Use in generator" }));

    expect(setItemSpy).toHaveBeenCalledWith(
      "magiceyelab:generator",
      expect.stringContaining("data:image/png;base64,pattern"),
    );
  });
});
