import type { StereogramSettings } from "../../types/stereogram";

type RenderStereogramOptions = {
  canvas: HTMLCanvasElement;
  depthImage: HTMLImageElement;
  patternImage: HTMLImageElement;
  settings: StereogramSettings;
  showDepthOverlay?: boolean;
};

const maxPatternSampleSize = 512;

function getClampedSize(width: number, height: number, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createImageCanvas(
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not create image canvas context.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return { canvas, context };
}

export function renderStereogram({
  canvas,
  depthImage,
  patternImage,
  settings,
  showDepthOverlay = false,
}: RenderStereogramOptions) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create stereogram canvas context.");
  }

  const outputWidth = settings.width;
  const outputHeight = settings.height;
  const repeatWidth = Math.max(1, Math.min(settings.repeatWidth, outputWidth));
  const maxDepthShift = Math.round(
    repeatWidth * Math.max(0, settings.depthStrength) * 0.003,
  );

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const { context: depthContext } = createImageCanvas(
    depthImage,
    outputWidth,
    outputHeight,
  );
  const patternSize = getClampedSize(
    patternImage.naturalWidth,
    patternImage.naturalHeight,
    maxPatternSampleSize,
  );
  const { canvas: patternCanvas, context: patternContext } = createImageCanvas(
    patternImage,
    patternSize.width,
    patternSize.height,
  );

  const depthPixels = depthContext.getImageData(0, 0, outputWidth, outputHeight);
  const patternPixels = patternContext.getImageData(
    0,
    0,
    patternCanvas.width,
    patternCanvas.height,
  );
  const outputPixels = context.createImageData(outputWidth, outputHeight);

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const outputIndex = (y * outputWidth + x) * 4;
      const depthIndex = outputIndex;
      const luminance =
        depthPixels.data[depthIndex] * 0.299 +
        depthPixels.data[depthIndex + 1] * 0.587 +
        depthPixels.data[depthIndex + 2] * 0.114;
      const depth = settings.invertDepth ? 255 - luminance : luminance;
      const shift = Math.round((depth / 255) * maxDepthShift);
      const linkedX = x - repeatWidth + shift;

      if (linkedX >= 0) {
        const linkedIndex = (y * outputWidth + linkedX) * 4;
        outputPixels.data[outputIndex] = outputPixels.data[linkedIndex];
        outputPixels.data[outputIndex + 1] = outputPixels.data[linkedIndex + 1];
        outputPixels.data[outputIndex + 2] = outputPixels.data[linkedIndex + 2];
        outputPixels.data[outputIndex + 3] = 255;
        continue;
      }

      const patternX = x % patternCanvas.width;
      const patternY = y % patternCanvas.height;
      const patternIndex = (patternY * patternCanvas.width + patternX) * 4;

      outputPixels.data[outputIndex] = patternPixels.data[patternIndex];
      outputPixels.data[outputIndex + 1] = patternPixels.data[patternIndex + 1];
      outputPixels.data[outputIndex + 2] = patternPixels.data[patternIndex + 2];
      outputPixels.data[outputIndex + 3] = 255;
    }
  }

  if (showDepthOverlay) {
    for (let index = 0; index < outputPixels.data.length; index += 4) {
      const luminance =
        depthPixels.data[index] * 0.299 +
        depthPixels.data[index + 1] * 0.587 +
        depthPixels.data[index + 2] * 0.114;
      const depth = settings.invertDepth ? 255 - luminance : luminance;
      const overlayAlpha = 0.42;
      const highlight = depth / 255;
      const overlayRed = 30 + 225 * highlight;
      const overlayGreen = 220 - 120 * highlight;
      const overlayBlue = 210 - 185 * highlight;

      outputPixels.data[index] =
        outputPixels.data[index] * (1 - overlayAlpha) + overlayRed * overlayAlpha;
      outputPixels.data[index + 1] =
        outputPixels.data[index + 1] * (1 - overlayAlpha) +
        overlayGreen * overlayAlpha;
      outputPixels.data[index + 2] =
        outputPixels.data[index + 2] * (1 - overlayAlpha) +
        overlayBlue * overlayAlpha;
    }
  }

  context.putImageData(outputPixels, 0, 0);
}
