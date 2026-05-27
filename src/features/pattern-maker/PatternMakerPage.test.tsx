import { cleanup, render, screen } from "@testing-library/react";
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
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    stroke: vi.fn(),
    set fillStyle(_value: unknown) {},
    set lineCap(_value: unknown) {},
    set lineJoin(_value: unknown) {},
    set lineWidth(_value: unknown) {},
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
