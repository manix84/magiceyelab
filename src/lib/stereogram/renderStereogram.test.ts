import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderStereogram } from "./renderStereogram";

function createPixels(width: number, height: number, pixel: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const [red, green, blue, alpha = 255] = pixel(x, y);
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = alpha;
    }
  }

  return { data, width, height } as ImageData;
}

function createImage(width: number, height: number) {
  return {
    naturalWidth: width,
    naturalHeight: height,
  } as HTMLImageElement;
}

function expectRenderedPixels(pixels: ImageData | null) {
  expect(pixels).not.toBeNull();
  return pixels as ImageData;
}

describe("renderStereogram", () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let renderedPixels: ImageData | null;
  let offscreenReadIndex: number;

  beforeEach(() => {
    renderedPixels = null;
    offscreenReadIndex = 0;

    const depthPixels = createPixels(4, 2, (x) => {
      const value = x < 2 ? 0 : 255;
      return [value, value, value, 255];
    });
    const patternPixels = createPixels(4, 4, (x, y) => [
      x * 40,
      y * 40,
      200 - x * 20,
      255,
    ]);

    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(function getContextMock(this: HTMLCanvasElement) {
        if (this.dataset.testOutputCanvas === "true") {
          return {
            createImageData: vi.fn((width: number, height: number) => ({
              data: new Uint8ClampedArray(width * height * 4),
              width,
              height,
            })),
            putImageData: vi.fn((pixels: ImageData) => {
              renderedPixels = pixels;
            }),
          } as unknown as CanvasRenderingContext2D;
        }

        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(() => {
            offscreenReadIndex += 1;
            return offscreenReadIndex % 2 === 1 ? depthPixels : patternPixels;
          }),
        } as unknown as CanvasRenderingContext2D;
      });
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it("writes opaque stereogram pixels to the output canvas", () => {
    const canvas = document.createElement("canvas");
    canvas.dataset.testOutputCanvas = "true";

    renderStereogram({
      canvas,
      depthImage: createImage(4, 2),
      patternImage: createImage(4, 4),
      settings: {
        width: 4,
        height: 2,
        repeatWidth: 2,
        depthStrength: 50,
        invertDepth: false,
      },
    });

    const pixels = expectRenderedPixels(renderedPixels);

    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(2);
    expect(pixels.data[3]).toBe(255);
    expect(pixels.data[7]).toBe(255);
  });

  it("uses pattern offsets for animated preview frames", () => {
    const firstCanvas = document.createElement("canvas");
    firstCanvas.dataset.testOutputCanvas = "true";

    renderStereogram({
      canvas: firstCanvas,
      depthImage: createImage(4, 2),
      patternImage: createImage(4, 4),
      patternOffsetX: 0,
      settings: {
        width: 4,
        height: 2,
        repeatWidth: 2,
        depthStrength: 0,
        invertDepth: false,
      },
    });

    const firstRed = expectRenderedPixels(renderedPixels).data[0];
    renderedPixels = null;

    const secondCanvas = document.createElement("canvas");
    secondCanvas.dataset.testOutputCanvas = "true";
    const secondDepthImage = createImage(4, 2);
    const secondPatternImage = createImage(4, 4);

    renderStereogram({
      canvas: secondCanvas,
      depthImage: secondDepthImage,
      patternImage: secondPatternImage,
      patternOffsetX: 1,
      settings: {
        width: 4,
        height: 2,
        repeatWidth: 2,
        depthStrength: 0,
        invertDepth: false,
      },
    });

    expect(expectRenderedPixels(renderedPixels).data[0]).not.toBe(firstRed);
  });

  it("applies the depth overlay when requested", () => {
    const canvas = document.createElement("canvas");
    canvas.dataset.testOutputCanvas = "true";

    renderStereogram({
      canvas,
      depthImage: createImage(4, 2),
      patternImage: createImage(4, 4),
      settings: {
        width: 4,
        height: 2,
        repeatWidth: 2,
        depthStrength: 0,
        invertDepth: false,
      },
      showDepthOverlay: true,
    });

    const pixels = expectRenderedPixels(renderedPixels);

    expect(pixels.data[0]).not.toBe(0);
    expect(pixels.data[2]).not.toBe(200);
  });
});
