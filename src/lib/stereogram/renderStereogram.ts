import type { StereogramSettings } from "../../types/stereogram";

type RenderStereogramOptions = {
  canvas: HTMLCanvasElement;
  depthImage: HTMLImageElement;
  patternImage: HTMLImageElement;
  settings: StereogramSettings;
  patternOffsetX?: number;
  patternOffsetY?: number;
  showDepthOverlay?: boolean;
};

const maxPatternSampleSize = 512;
const depthOverlayAlpha = 0.64;
const contourBandAlpha = 0.36;
const contourBandWidth = 0.055;
const imageDataCache = new WeakMap<HTMLImageElement, Map<string, ImageData>>();

function getClampedSize(width: number, height: number, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createImageCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not create image canvas context.");
  }

  canvas.width = width;
  canvas.height = height;

  return { canvas, context };
}

function getImagePixels(image: HTMLImageElement, width: number, height: number) {
  const cacheKey = `${width}x${height}`;
  const imageCache = imageDataCache.get(image) ?? new Map<string, ImageData>();
  const cachedPixels = imageCache.get(cacheKey);

  if (cachedPixels) {
    return cachedPixels;
  }

  const { context } = createImageCanvas(width, height);
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  imageCache.set(cacheKey, pixels);
  imageDataCache.set(image, imageCache);

  return pixels;
}

export function renderStereogram({
  canvas,
  depthImage,
  patternImage,
  patternOffsetX = 0,
  patternOffsetY = 0,
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

  const patternSize = getClampedSize(
    patternImage.naturalWidth,
    patternImage.naturalHeight,
    maxPatternSampleSize,
  );

  const depthPixels = getImagePixels(depthImage, outputWidth, outputHeight);
  const patternPixels = getImagePixels(
    patternImage,
    patternSize.width,
    patternSize.height,
  );
  const patternScale = patternSize.width / repeatWidth;
  const scaledPatternHeight = Math.max(
    1,
    Math.round(patternSize.height / patternScale),
  );
  const normalizedPatternOffsetX =
    ((patternOffsetX % repeatWidth) + repeatWidth) % repeatWidth;
  const normalizedPatternOffsetY =
    ((patternOffsetY % scaledPatternHeight) + scaledPatternHeight) %
    scaledPatternHeight;
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

      const patternX = Math.min(
        patternSize.width - 1,
        Math.floor(((x + normalizedPatternOffsetX) % repeatWidth) * patternScale),
      );
      const patternY = Math.min(
        patternSize.height - 1,
        Math.floor(
          ((y + normalizedPatternOffsetY) % scaledPatternHeight) * patternScale,
        ),
      );
      const patternIndex = (patternY * patternSize.width + patternX) * 4;

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
      const highlight = depth / 255;
      const warmRamp = Math.max(0, (highlight - 0.48) / 0.52);
      const coolRamp = Math.max(0, (0.52 - highlight) / 0.52);
      const contourDistance = Math.abs((highlight * 10) % 1 - 0.5);
      const contourAlpha =
        contourDistance < contourBandWidth ? contourBandAlpha : 0;
      const overlayAlpha = Math.min(0.82, depthOverlayAlpha + contourAlpha);
      const overlayRed = 28 + 227 * warmRamp;
      const overlayGreen = 238 - 142 * warmRamp - 40 * coolRamp;
      const overlayBlue = 255 - 224 * warmRamp - 78 * coolRamp;

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
