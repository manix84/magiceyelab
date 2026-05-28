import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DepthPainterPage } from "./DepthPainterPage";

function createImageData(width: number, height: number, value = 128) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }

  return { data, width, height } as ImageData;
}

function createCanvasContextMock() {
  const state = {
    fillStyle: "",
    globalAlpha: 1,
  };

  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn((...args: number[]) => {
      const width = args[2] ?? 1;
      const height = args[3] ?? 1;
      return createImageData(width, height);
    }),
    putImageData: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    set fillStyle(value: string) {
      state.fillStyle = value;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value;
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set imageSmoothingEnabled(_value: boolean) {},
    state,
  };
}

function renderDepthPainterPage() {
  return render(
    <MemoryRouter>
      <DepthPainterPage />
    </MemoryRouter>,
  );
}

function mockCanvasBounds(canvas: HTMLCanvasElement) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    bottom: 512,
    height: 512,
    left: 0,
    right: 512,
    toJSON: () => undefined,
    top: 0,
    width: 512,
    x: 0,
    y: 0,
  });
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => true);
}

describe("DepthPainterPage", () => {
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
      .mockReturnValue("data:image/png;base64,depth");
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

  it("renders a monochrome painting canvas and default controls", () => {
    renderDepthPainterPage();

    expect(screen.getByLabelText("Depth map painting canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brush" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("slider", { name: "Size" })).toHaveValue("32");
    expect(screen.getByRole("slider", { name: "Opacity" })).toHaveValue("100");
    expect(screen.getByRole("slider", { name: "Depth value" })).toHaveValue("180");
    expect(screen.getByLabelText("Show grid")).toBeChecked();
  });

  it("restores stored depth painter controls", () => {
    storage.set(
      "magiceyelab:depth-painter",
      JSON.stringify({
        version: 1,
        selectedTool: "fill",
        brushSize: 64,
        brushOpacity: 55,
        depthValue: 220,
        fillTolerance: 21,
        showGrid: false,
        imageDataUrl: "",
      }),
    );

    renderDepthPainterPage();

    expect(screen.getByRole("button", { name: "Fill" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("slider", { name: "Depth value" })).toHaveValue("220");
    expect(screen.getByRole("slider", { name: "Fill tolerance" })).toHaveValue("21");
    expect(screen.getByLabelText("Show grid")).not.toBeChecked();
  });

  it("paints and erases depth values on the canvas", async () => {
    const user = userEvent.setup();
    renderDepthPainterPage();

    const canvas = screen.getByLabelText("Depth map painting canvas") as HTMLCanvasElement;
    mockCanvasBounds(canvas);

    fireEvent.pointerDown(canvas, {
      clientX: 128,
      clientY: 128,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(canvas, {
      clientX: 180,
      clientY: 180,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(context.arc).toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalled();
    expect(toDataUrlSpy).toHaveBeenCalledWith("image/png");

    await user.click(screen.getByRole("button", { name: "Eraser" }));
    fireEvent.pointerDown(canvas, {
      clientX: 128,
      clientY: 128,
      pointerId: 2,
      pointerType: "mouse",
    });

    expect(context.state.fillStyle).toBe("rgb(128 128 128)");
  });

  it("fills contiguous depth areas and supports undo and redo", async () => {
    const user = userEvent.setup();
    renderDepthPainterPage();

    const canvas = screen.getByLabelText("Depth map painting canvas") as HTMLCanvasElement;
    mockCanvasBounds(canvas);

    await user.click(screen.getByRole("button", { name: "Fill" }));
    fireEvent.pointerDown(canvas, {
      clientX: 4,
      clientY: 4,
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(context.putImageData).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Redo" }));

    expect(context.putImageData).toHaveBeenCalledTimes(3);
  });

  it("supports keyboard shortcuts for depth tools and history", async () => {
    renderDepthPainterPage();

    const canvas = screen.getByLabelText("Depth map painting canvas") as HTMLCanvasElement;
    mockCanvasBounds(canvas);

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

    fireEvent.pointerDown(canvas, {
      clientX: 128,
      clientY: 128,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 1,
      pointerType: "mouse",
    });

    fireEvent.keyDown(window, { key: "z", metaKey: true });
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });

    expect(context.putImageData).toHaveBeenCalledTimes(2);
  });

  it("exports and sends the depth map to the generator", async () => {
    const user = userEvent.setup();

    renderDepthPainterPage();

    await user.click(screen.getByRole("button", { name: "Export PNG" }));

    expect(toDataUrlSpy).toHaveBeenCalledWith("image/png");
    expect(anchorClickSpy).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Use in generator" }));

    expect(setItemSpy).toHaveBeenCalledWith(
      "magiceyelab:generator",
      expect.stringContaining("depth-painter-map.png"),
    );
    expect(setItemSpy).toHaveBeenCalledWith(
      "magiceyelab:generator",
      expect.stringContaining("data:image/png;base64,depth"),
    );
  });
});
