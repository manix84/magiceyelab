import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  };
}

describe("PatternMakerPage", () => {
  let context: ReturnType<typeof createCanvasContextMock>;
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    context = createCanvasContextMock();
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    getContextSpy.mockRestore();
  });

  it("renders the paint tile and repeat preview canvases", () => {
    render(<PatternMakerPage />);

    expect(screen.getByLabelText("Pattern painting tile")).toBeInTheDocument();
    expect(screen.getByLabelText("Seamless pattern preview")).toBeInTheDocument();
  });

  it("generates wrapped motifs for random patterns", async () => {
    const user = userEvent.setup();
    render(<PatternMakerPage />);

    await user.click(screen.getByRole("button", { name: "Random pattern" }));

    expect(context.stroke).toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalled();
    expect(context.createPattern).toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalled();
  });
});
