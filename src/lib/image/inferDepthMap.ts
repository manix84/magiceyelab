export type DepthMapInferenceKind = "depth-map" | "stereo-pair" | "photo";

export type DepthMapInference = {
  image: HTMLImageElement;
  kind: DepthMapInferenceKind;
  confidence: number;
  message: string;
};

type ImageStats = {
  averageChannelSpread: number;
  luminanceDeviation: number;
  stereoHalfDifference: number;
};

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not create image processing context.");
  }

  canvas.width = width;
  canvas.height = height;

  return { canvas, context };
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create inferred depth map."));
        return;
      }

      const image = new Image();
      const url = URL.createObjectURL(blob);

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not create inferred depth map."));
      };
      image.src = url;
    }, "image/png");
  });
}

function waitForFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function sampleImageStats(image: HTMLImageElement): ImageStats {
  const width = 96;
  const height = Math.max(1, Math.round(width / (image.naturalWidth / image.naturalHeight)));
  const { context } = createCanvas(width, height);
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height).data;
  const luminanceValues: number[] = [];
  let totalChannelSpread = 0;
  let totalStereoHalfDifference = 0;
  let stereoSamples = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

      luminanceValues.push(luminance);
      totalChannelSpread += Math.max(red, green, blue) - Math.min(red, green, blue);

      if (x < width / 2) {
        const pairedIndex = (y * width + x + Math.floor(width / 2)) * 4;
        const pairedLuminance =
          pixels[pairedIndex] * 0.299 +
          pixels[pairedIndex + 1] * 0.587 +
          pixels[pairedIndex + 2] * 0.114;
        totalStereoHalfDifference += Math.abs(luminance - pairedLuminance);
        stereoSamples += 1;
      }
    }
  }

  const averageLuminance =
    luminanceValues.reduce((total, value) => total + value, 0) / luminanceValues.length;
  const luminanceDeviation =
    luminanceValues.reduce(
      (total, value) => total + Math.abs(value - averageLuminance),
      0,
    ) / luminanceValues.length;

  return {
    averageChannelSpread: totalChannelSpread / luminanceValues.length,
    luminanceDeviation,
    stereoHalfDifference: totalStereoHalfDifference / Math.max(1, stereoSamples),
  };
}

function classifyDepthInput(image: HTMLImageElement, stats: ImageStats) {
  const aspectRatio = image.naturalWidth / image.naturalHeight;
  const looksGrayscale = stats.averageChannelSpread < 8;
  const hasDepthRange = stats.luminanceDeviation > 12;
  const looksSideBySideStereo =
    aspectRatio >= 1.75 && aspectRatio <= 2.35 && stats.stereoHalfDifference < 70;

  if (looksGrayscale && hasDepthRange) {
    return {
      kind: "depth-map" as const,
      confidence: Math.round(Math.min(98, 70 + (8 - stats.averageChannelSpread) * 3)),
    };
  }

  if (looksSideBySideStereo) {
    return {
      kind: "stereo-pair" as const,
      confidence: Math.round(Math.max(52, 88 - stats.stereoHalfDifference * 0.5)),
    };
  }

  return {
    kind: "photo" as const,
    confidence: Math.round(Math.max(45, 78 - stats.averageChannelSpread * 0.3)),
  };
}

async function inferDepthFromPhoto(image: HTMLImageElement) {
  const width = Math.min(1000, image.naturalWidth);
  const height = Math.max(1, Math.round(width / (image.naturalWidth / image.naturalHeight)));
  const { canvas, context } = createCanvas(width, height);
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);

  for (let y = 0; y < height; y += 1) {
    const verticalDepth = 1 - y / Math.max(1, height - 1);

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
      const saturation = (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
      const centerX = Math.abs(x / Math.max(1, width - 1) - 0.5) * 2;
      const centerY = Math.abs(y / Math.max(1, height - 1) - 0.5) * 2;
      const centerDepth = 1 - Math.min(1, Math.hypot(centerX, centerY) / 1.35);
      const depth =
        luminance * 0.38 + saturation * 0.18 + centerDepth * 0.28 + verticalDepth * 0.16;
      const value = Math.round(Math.max(0, Math.min(255, depth * 255)));

      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
  }

  context.putImageData(pixels, 0, 0);

  return canvasToImage(canvas);
}

async function inferDepthFromStereoPair(image: HTMLImageElement) {
  const sourceHalfWidth = Math.floor(image.naturalWidth / 2);
  const width = Math.min(420, sourceHalfWidth);
  const height = Math.max(1, Math.round(width / (sourceHalfWidth / image.naturalHeight)));
  const { context: leftContext } = createCanvas(width, height);
  const { context: rightContext } = createCanvas(width, height);
  const { canvas: outputCanvas, context: outputContext } = createCanvas(width, height);

  leftContext.drawImage(image, 0, 0, sourceHalfWidth, image.naturalHeight, 0, 0, width, height);
  rightContext.drawImage(
    image,
    sourceHalfWidth,
    0,
    sourceHalfWidth,
    image.naturalHeight,
    0,
    0,
    width,
    height,
  );

  const leftPixels = leftContext.getImageData(0, 0, width, height).data;
  const rightPixels = rightContext.getImageData(0, 0, width, height).data;
  const outputPixels = outputContext.createImageData(width, height);
  const maxDisparity = Math.max(4, Math.round(width * 0.055));
  const radius = 1;

  function luminance(data: Uint8ClampedArray, x: number, y: number) {
    const index = (y * width + x) * 4;
    return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let bestDisparity = 0;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const direction of [-1, 1]) {
        for (let disparity = 0; disparity <= maxDisparity; disparity += 1) {
          const rightX = x + direction * disparity;

          if (
            rightX < radius ||
            rightX >= width - radius ||
            x < radius ||
            x >= width - radius
          ) {
            continue;
          }

          let score = 0;

          for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
            const sampleY = Math.max(0, Math.min(height - 1, y + offsetY));

            for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
              score += Math.abs(
                luminance(leftPixels, x + offsetX, sampleY) -
                  luminance(rightPixels, rightX + offsetX, sampleY),
              );
            }
          }

          if (score < bestScore) {
            bestScore = score;
            bestDisparity = disparity;
          }
        }
      }

      const index = (y * width + x) * 4;
      const value = Math.round((bestDisparity / maxDisparity) * 255);
      outputPixels.data[index] = value;
      outputPixels.data[index + 1] = value;
      outputPixels.data[index + 2] = value;
      outputPixels.data[index + 3] = 255;
    }

    if (y > 0 && y % 8 === 0) {
      await waitForFrame();
    }
  }

  outputContext.putImageData(outputPixels, 0, 0);

  return canvasToImage(outputCanvas);
}

export async function inferDepthMap(
  image: HTMLImageElement,
): Promise<DepthMapInference> {
  const stats = sampleImageStats(image);
  const classification = classifyDepthInput(image, stats);

  if (classification.kind === "depth-map") {
    return {
      image,
      ...classification,
      message: `Detected grayscale depth map (${classification.confidence}% confidence).`,
    };
  }

  if (classification.kind === "stereo-pair") {
    return {
      image: await inferDepthFromStereoPair(image),
      ...classification,
      message: `Detected side-by-side stereo image; generated a disparity depth map (${classification.confidence}% confidence).`,
    };
  }

  return {
    image: await inferDepthFromPhoto(image),
    ...classification,
    message: `Detected regular 2D image; estimated a grayscale depth map (${classification.confidence}% confidence).`,
  };
}
