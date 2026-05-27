import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import {
  mdiBrush,
  mdiDiceMultiple,
  mdiDownload,
  mdiEraser,
  mdiEyedropper,
  mdiFormatColorFill,
  mdiGrid,
  mdiImageEdit,
  mdiPalette,
  mdiPencil,
  mdiRedo,
  mdiSend,
  mdiShapeCirclePlus,
  mdiShapeSquarePlus,
  mdiVectorLine,
  mdiSwapHorizontal,
  mdiTrashCanOutline,
  mdiUndo,
  mdiUpload,
  mdiVectorSquare,
} from "@mdi/js";
import { useNavigate } from "react-router-dom";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";
import { storageKeys } from "../../lib/storage/keys";
import styles from "./PatternMakerPage.module.scss";

const palette = ["#1d3557", "#e63946", "#f1faee", "#2a9d8f", "#f4a261"];
const tileSize = 512;
const seamSize = 56;
const repeatPreviewTileSize = 160;
const defaultBrushSize = 36;
const defaultBrushHardness = 25;
const defaultBrushFlow = 35;
const defaultBrushSpacing = 8;
const maxHistoryStates = 24;
const acceptedPatternTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
type PatternTool = "pencil" | "brush" | "eraser" | "eyedropper" | "fill" | "shape";
type BrushShape = "circle" | "square";
type FillMode = "contiguous" | "global";
type ShapeKind = "line" | "rectangle" | "ellipse";
type ShapeMode = "stroke" | "fill" | "stroke-and-fill";
type ShapeBlendMode = "paint" | "erase";
type CanvasPoint = {
  x: number;
  y: number;
};
type StrokePoint = CanvasPoint & {
  pressure: number;
};
type ShapeDraft = {
  constrain: boolean;
  current: CanvasPoint;
  fromCenter: boolean;
  start: CanvasPoint;
};
type BrushCursorStyle = CSSProperties & {
  "--brush-cursor-color": string;
  "--brush-cursor-size": string;
  "--brush-cursor-x": string;
  "--brush-cursor-y": string;
};
type ImplementDemoStyle = CSSProperties & {
  "--implement-demo-color": string;
  "--implement-demo-hardness": string;
  "--implement-demo-opacity": number;
  "--implement-demo-size": string;
};

type StoredGeneratorState = {
  version: 1;
  exportName: string;
  depthStrength: number;
  repeatWidth: number;
  showDepthOverlay: boolean;
  depthFileName: string;
  depthInferenceMessage: string;
  depthImageDataUrl: string;
  patternFileName: string;
  patternImageDataUrl: string;
};
type StoredPatternMakerState = {
  version: 1;
  selectedTool: PatternTool;
  selectedColor: string;
  recentColors: string[];
  brushShape: BrushShape;
  brushSize: number;
  brushOpacity: number;
  brushHardness: number;
  brushFlow: number;
  brushSpacing: number;
  fillMode: FillMode;
  fillTolerance: number;
  shapeBlendMode: ShapeBlendMode;
  shapeKind: ShapeKind;
  shapeMode: ShapeMode;
  showGrid: boolean;
  showTileBoundary: boolean;
  imageDataUrl: string;
};

const defaultGeneratorState: StoredGeneratorState = {
  version: 1,
  exportName: "",
  depthStrength: 45,
  repeatWidth: 120,
  showDepthOverlay: false,
  depthFileName: "",
  depthInferenceMessage: "",
  depthImageDataUrl: "",
  patternFileName: "",
  patternImageDataUrl: "",
};
const defaultPatternMakerState: StoredPatternMakerState = {
  version: 1,
  selectedTool: "brush",
  selectedColor: palette[0],
  recentColors: [],
  brushShape: "circle",
  brushSize: defaultBrushSize,
  brushOpacity: 100,
  brushHardness: defaultBrushHardness,
  brushFlow: defaultBrushFlow,
  brushSpacing: defaultBrushSpacing,
  fillMode: "contiguous",
  fillTolerance: 8,
  shapeBlendMode: "paint",
  shapeKind: "rectangle",
  shapeMode: "stroke",
  showGrid: true,
  showTileBoundary: true,
  imageDataUrl: "",
};

function getCanvasPoint(
  event: PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
) {
  const bounds = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

function getStrokePoint(
  event: PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): StrokePoint {
  const point = getCanvasPoint(event, canvas);
  const pressure = event.pointerType === "pen"
    ? Math.max(event.pressure || 0, 0.05)
    : 1;

  return { ...point, pressure };
}

function drawWrappedCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  for (const offsetX of [-tileSize, 0, tileSize]) {
    for (const offsetY of [-tileSize, 0, tileSize]) {
      context.beginPath();
      context.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawWrappedLine(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  for (const offsetX of [-tileSize, 0, tileSize]) {
    for (const offsetY of [-tileSize, 0, tileSize]) {
      context.beginPath();
      context.moveTo(startX + offsetX, startY + offsetY);
      context.lineTo(endX + offsetX, endY + offsetY);
      context.stroke();
    }
  }
}

function createRepeatPreviewTile(sourceCanvas: HTMLCanvasElement) {
  const previewTile = document.createElement("canvas");
  const previewContext = previewTile.getContext("2d");

  if (!previewContext) {
    return null;
  }

  previewTile.width = repeatPreviewTileSize;
  previewTile.height = repeatPreviewTileSize;
  previewContext.drawImage(
    sourceCanvas,
    0,
    0,
    tileSize,
    tileSize,
    0,
    0,
    repeatPreviewTileSize,
    repeatPreviewTileSize,
  );

  return previewTile;
}

function readStoredGeneratorState() {
  try {
    const storedValue = window.localStorage.getItem(storageKeys.generator);

    if (!storedValue) {
      return defaultGeneratorState;
    }

    return {
      ...defaultGeneratorState,
      ...(JSON.parse(storedValue) as Partial<StoredGeneratorState>),
      version: 1 as const,
    };
  } catch {
    return defaultGeneratorState;
  }
}

function readStoredPatternMakerState(): StoredPatternMakerState {
  try {
    const storedValue = window.localStorage.getItem(storageKeys.patternMaker);

    if (!storedValue) {
      return defaultPatternMakerState;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredPatternMakerState>;
    const selectedColor = normaliseHexColor(parsedValue.selectedColor ?? "")
      ?? defaultPatternMakerState.selectedColor;

    return {
      ...defaultPatternMakerState,
      ...parsedValue,
      version: 1 as const,
      selectedTool: ["brush", "eraser", "eyedropper", "fill", "pencil", "shape"].includes(
        parsedValue.selectedTool ?? "",
      )
        ? parsedValue.selectedTool as PatternTool
        : defaultPatternMakerState.selectedTool,
      selectedColor,
      recentColors: Array.isArray(parsedValue.recentColors)
        ? parsedValue.recentColors
          .map((color) => normaliseHexColor(color))
          .filter((color): color is string => Boolean(color))
          .slice(0, 5)
        : [],
      brushShape: parsedValue.brushShape === "square" ? "square" as const : "circle" as const,
      brushSize: clampNumber(
        parsedValue.brushSize,
        1,
        96,
        defaultPatternMakerState.brushSize,
      ),
      brushOpacity: clampNumber(
        parsedValue.brushOpacity,
        10,
        100,
        defaultPatternMakerState.brushOpacity,
      ),
      brushHardness: clampNumber(
        parsedValue.brushHardness,
        0,
        100,
        defaultPatternMakerState.brushHardness,
      ),
      brushFlow: clampNumber(
        parsedValue.brushFlow,
        1,
        100,
        defaultPatternMakerState.brushFlow,
      ),
      brushSpacing: clampNumber(
        parsedValue.brushSpacing,
        5,
        100,
        defaultPatternMakerState.brushSpacing,
      ),
      fillMode: parsedValue.fillMode === "global" ? "global" as const : "contiguous" as const,
      fillTolerance: clampNumber(
        parsedValue.fillTolerance,
        0,
        64,
        defaultPatternMakerState.fillTolerance,
      ),
      shapeBlendMode: parsedValue.shapeBlendMode === "erase" ? "erase" as const : "paint" as const,
      shapeKind: ["line", "rectangle", "ellipse"].includes(parsedValue.shapeKind ?? "")
        ? parsedValue.shapeKind as ShapeKind
        : defaultPatternMakerState.shapeKind,
      shapeMode: ["stroke", "fill", "stroke-and-fill"].includes(parsedValue.shapeMode ?? "")
        ? parsedValue.shapeMode as ShapeMode
        : defaultPatternMakerState.shapeMode,
      showGrid: parsedValue.showGrid !== false,
      showTileBoundary: parsedValue.showTileBoundary !== false,
      imageDataUrl:
        typeof parsedValue.imageDataUrl === "string" ? parsedValue.imageDataUrl : "",
    };
  } catch {
    return defaultPatternMakerState;
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function loadImageSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load stored pattern image."));
    image.src = source;
  });
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read pattern file."));
        return;
      }

      void loadImageSource(reader.result).then(resolve).catch(reject);
    };
    reader.onerror = () => reject(new Error("Could not read pattern file."));
    reader.readAsDataURL(file);
  });
}

function formatColorComponent(value: number) {
  return value.toString(16).padStart(2, "0");
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${formatColorComponent(red)}${formatColorComponent(green)}${formatColorComponent(blue)}`;
}

function hexToRgba(value: string, alpha: number) {
  const color = hexToRgb(value);

  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${alpha})`;
}

function normaliseHexColor(value: string) {
  const trimmedValue = value.trim();
  const color = trimmedValue.startsWith("#") ? trimmedValue : `#${trimmedValue}`;

  return /^#[\da-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}

function hexToRgb(value: string) {
  const color = normaliseHexColor(value) ?? palette[0];

  return {
    red: Number.parseInt(color.slice(1, 3), 16),
    green: Number.parseInt(color.slice(3, 5), 16),
    blue: Number.parseInt(color.slice(5, 7), 16),
  };
}

function getPixelOffset(x: number, y: number, width: number) {
  return (y * width + x) * 4;
}

function colorMatches(
  data: Uint8ClampedArray,
  offset: number,
  target: { red: number; green: number; blue: number; alpha: number },
  tolerance: number,
) {
  return (
    Math.abs(data[offset] - target.red) <= tolerance &&
    Math.abs(data[offset + 1] - target.green) <= tolerance &&
    Math.abs(data[offset + 2] - target.blue) <= tolerance &&
    Math.abs(data[offset + 3] - target.alpha) <= tolerance
  );
}

function disableCanvasSmoothing(context: CanvasRenderingContext2D) {
  context.imageSmoothingEnabled = false;
}

function writeStoredGeneratorPattern(patternImageDataUrl: string) {
  const storedGeneratorState = readStoredGeneratorState();
  const nextGeneratorState: StoredGeneratorState = {
    ...storedGeneratorState,
    patternFileName: "pattern-maker-tile.png",
    patternImageDataUrl,
  };

  window.localStorage.setItem(
    storageKeys.generator,
    JSON.stringify(nextGeneratorState),
  );
}

export function PatternMakerPage() {
  const navigate = useNavigate();
  const [storedPatternMakerState] = useState(readStoredPatternMakerState);
  const [selectedTool, setSelectedTool] = useState<PatternTool>(
    storedPatternMakerState.selectedTool,
  );
  const [selectedColor, setSelectedColor] = useState(
    storedPatternMakerState.selectedColor,
  );
  const [colorInputValue, setColorInputValue] = useState(
    storedPatternMakerState.selectedColor,
  );
  const [recentColors, setRecentColors] = useState<string[]>(
    storedPatternMakerState.recentColors,
  );
  const [brushShape, setBrushShape] = useState<BrushShape>(
    storedPatternMakerState.brushShape,
  );
  const [brushSize, setBrushSize] = useState(storedPatternMakerState.brushSize);
  const [brushOpacity, setBrushOpacity] = useState(
    storedPatternMakerState.brushOpacity,
  );
  const [brushHardness, setBrushHardness] = useState(
    storedPatternMakerState.brushHardness,
  );
  const [brushFlow, setBrushFlow] = useState(storedPatternMakerState.brushFlow);
  const [brushSpacing, setBrushSpacing] = useState(
    storedPatternMakerState.brushSpacing,
  );
  const [fillMode, setFillMode] = useState<FillMode>(
    storedPatternMakerState.fillMode,
  );
  const [fillTolerance, setFillTolerance] = useState(
    storedPatternMakerState.fillTolerance,
  );
  const [shapeBlendMode, setShapeBlendMode] = useState<ShapeBlendMode>(
    storedPatternMakerState.shapeBlendMode,
  );
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>(
    storedPatternMakerState.shapeKind,
  );
  const [shapeMode, setShapeMode] = useState<ShapeMode>(
    storedPatternMakerState.shapeMode,
  );
  const [showGrid, setShowGrid] = useState(storedPatternMakerState.showGrid);
  const [showTileBoundary, setShowTileBoundary] = useState(
    storedPatternMakerState.showTileBoundary,
  );
  const [transferMessage, setTransferMessage] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [brushPreviewPoint, setBrushPreviewPoint] = useState<CanvasPoint | null>(null);
  const [hoverSampleColor, setHoverSampleColor] = useState(selectedColor);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const topSeamRef = useRef<HTMLCanvasElement>(null);
  const rightSeamRef = useRef<HTMLCanvasElement>(null);
  const bottomSeamRef = useRef<HTMLCanvasElement>(null);
  const leftSeamRef = useRef<HTMLCanvasElement>(null);
  const repeatPreviewRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef<StrokePoint | null>(null);
  const strokeBaseRef = useRef<ImageData | null>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const shapeDraftRef = useRef<ShapeDraft | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const hasRestoredDraftRef = useRef(false);

  function selectColor(color: string) {
    const normalisedColor = normaliseHexColor(color);

    if (!normalisedColor) {
      return;
    }

    setSelectedColor(normalisedColor);
    setColorInputValue(normalisedColor);
    setRecentColors((colors) => [
      normalisedColor,
      ...colors.filter((recentColor) => recentColor !== normalisedColor),
    ].slice(0, 5));
  }

  function writePatternMakerDraft() {
    const canvas = paintCanvasRef.current;

    if (!canvas || !hasRestoredDraftRef.current) {
      return;
    }

    const payload: StoredPatternMakerState = {
      version: 1,
      selectedTool,
      selectedColor,
      recentColors,
      brushShape,
      brushSize,
      brushOpacity,
      brushHardness,
      brushFlow,
      brushSpacing,
      fillMode,
      fillTolerance,
      shapeBlendMode,
      shapeKind,
      shapeMode,
      showGrid,
      showTileBoundary,
      imageDataUrl: canvas.toDataURL("image/png"),
    };

    try {
      window.localStorage.setItem(storageKeys.patternMaker, JSON.stringify(payload));
    } catch {
      window.localStorage.removeItem(storageKeys.patternMaker);
    }
  }

  function schedulePatternMakerDraftSave() {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = window.setTimeout(() => {
      draftSaveTimeoutRef.current = null;
      writePatternMakerDraft();
    }, 250);
  }

  function syncHistoryState() {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }

  function updateShapeDraft(nextDraft: ShapeDraft | null) {
    shapeDraftRef.current = nextDraft;
    setShapeDraft(nextDraft);
  }

  function captureCanvasState() {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return null;
    }

    return context.getImageData(0, 0, tileSize, tileSize);
  }

  function pushUndoState() {
    const snapshot = captureCanvasState();

    if (!snapshot) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current, snapshot].slice(
      -maxHistoryStates,
    );
    redoStackRef.current = [];
    syncHistoryState();
  }

  function restoreCanvasState(snapshot: ImageData) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.putImageData(snapshot, 0, 0);
    renderPatternPreviews();
  }

  function renderPatternPreviews() {
    const paintCanvas = paintCanvasRef.current;
    const topSeam = topSeamRef.current;
    const rightSeam = rightSeamRef.current;
    const bottomSeam = bottomSeamRef.current;
    const leftSeam = leftSeamRef.current;
    const repeatPreview = repeatPreviewRef.current;

    if (!paintCanvas || !topSeam || !rightSeam || !bottomSeam || !leftSeam || !repeatPreview) {
      return;
    }

    const topContext = topSeam.getContext("2d");
    const rightContext = rightSeam.getContext("2d");
    const bottomContext = bottomSeam.getContext("2d");
    const leftContext = leftSeam.getContext("2d");
    const repeatContext = repeatPreview.getContext("2d");

    if (!topContext || !rightContext || !bottomContext || !leftContext || !repeatContext) {
      return;
    }

    const repeatBounds = repeatPreview.getBoundingClientRect();
    const repeatWidth = Math.max(tileSize, Math.round(repeatBounds.width));
    const repeatHeight = Math.max(tileSize, Math.round(repeatBounds.height));

    if (repeatPreview.width !== repeatWidth || repeatPreview.height !== repeatHeight) {
      repeatPreview.width = repeatWidth;
      repeatPreview.height = repeatHeight;
    }

    topContext.clearRect(0, 0, tileSize, seamSize);
    rightContext.clearRect(0, 0, seamSize, tileSize);
    bottomContext.clearRect(0, 0, tileSize, seamSize);
    leftContext.clearRect(0, 0, seamSize, tileSize);
    repeatContext.clearRect(0, 0, repeatWidth, repeatHeight);

    topContext.drawImage(
      paintCanvas,
      0,
      tileSize - seamSize,
      tileSize,
      seamSize,
      0,
      0,
      tileSize,
      seamSize,
    );
    rightContext.drawImage(
      paintCanvas,
      0,
      0,
      seamSize,
      tileSize,
      0,
      0,
      seamSize,
      tileSize,
    );
    bottomContext.drawImage(
      paintCanvas,
      0,
      0,
      tileSize,
      seamSize,
      0,
      0,
      tileSize,
      seamSize,
    );
    leftContext.drawImage(
      paintCanvas,
      tileSize - seamSize,
      0,
      seamSize,
      tileSize,
      0,
      0,
      seamSize,
      tileSize,
    );

    const previewTile = createRepeatPreviewTile(paintCanvas);

    if (!previewTile) {
      return;
    }

    const pattern = repeatContext.createPattern(previewTile, "repeat");

    if (pattern) {
      repeatContext.fillStyle = pattern;
      repeatContext.fillRect(0, 0, repeatWidth, repeatHeight);
    }

    schedulePatternMakerDraftSave();
  }

  function clearTile(pushHistory = true) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    if (pushHistory) {
      pushUndoState();
    }

    context.fillStyle = "#f7f5ef";
    context.fillRect(0, 0, tileSize, tileSize);
    renderPatternPreviews();
  }

  function getActiveBrushShape() {
    if (selectedTool === "pencil") {
      return "square";
    }

    return brushShape;
  }

  function getStampSettings(point: StrokePoint) {
    const pressure = Number.isFinite(point.pressure) ? point.pressure : 1;

    return {
      color: selectedTool === "eraser" ? "#000000" : selectedColor,
      flow: selectedTool === "pencil" ? 1 : (brushFlow / 100) * pressure,
      hardness: selectedTool === "pencil" ? 1 : brushHardness / 100,
      shape: getActiveBrushShape(),
      size: selectedTool === "pencil" ? brushSize : brushSize * pressure,
    };
  }

  function paintStamp(context: CanvasRenderingContext2D, point: StrokePoint) {
    const stamp = getStampSettings(point);

    if (selectedTool === "pencil") {
      disableCanvasSmoothing(context);
      context.globalAlpha = 1;
      context.fillStyle = stamp.color;

      const size = Math.max(1, Math.round(stamp.size));
      const halfSize = size / 2;
      const x = Math.floor(point.x - halfSize);
      const y = Math.floor(point.y - halfSize);

      for (const offsetX of [-tileSize, 0, tileSize]) {
        for (const offsetY of [-tileSize, 0, tileSize]) {
          context.fillRect(x + offsetX, y + offsetY, size, size);
        }
      }

      return;
    }

    context.globalAlpha = stamp.flow;

    try {
      for (const offsetX of [-tileSize, 0, tileSize]) {
        for (const offsetY of [-tileSize, 0, tileSize]) {
          const x = point.x + offsetX;
          const y = point.y + offsetY;

          if (stamp.shape === "square") {
            const halfSize = stamp.size / 2;
            context.fillStyle = stamp.color;
            context.fillRect(
              Math.round(x - halfSize),
              Math.round(y - halfSize),
              stamp.size,
              stamp.size,
            );
            continue;
          }

          const radius = stamp.size / 2;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);

          if (stamp.hardness >= 0.98) {
            context.fillStyle = stamp.color;
          } else {
            const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, stamp.color);
            gradient.addColorStop(Math.max(0, stamp.hardness), stamp.color);
            gradient.addColorStop(1, hexToRgba(stamp.color, 0));
            context.fillStyle = gradient;
          }

          context.fill();
        }
      }
    } finally {
      context.globalAlpha = 1;
    }
  }

  function compositeStrokeToCanvas() {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");
    const strokeBase = strokeBaseRef.current;
    const strokeCanvas = strokeCanvasRef.current;

    if (!canvas || !context || !strokeBase || !strokeCanvas) {
      return;
    }

    disableCanvasSmoothing(context);
    context.putImageData(strokeBase, 0, 0);
    context.globalAlpha = selectedTool === "pencil" ? 1 : brushOpacity / 100;
    context.globalCompositeOperation = selectedTool === "eraser" ? "destination-out" : "source-over";
    context.drawImage(strokeCanvas, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    renderPatternPreviews();
  }

  function paintAt(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = paintCanvasRef.current;
    const context = strokeContextRef.current;

    if (!canvas || !context) {
      return;
    }

    const point = getStrokePoint(event, canvas);
    const lastPoint = lastPointRef.current;

    if (!lastPoint) {
      paintStamp(context, point);
      lastPointRef.current = point;
      compositeStrokeToCanvas();
      return;
    }

    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    const spacing = Math.max(
      1,
      brushSize * (selectedTool === "pencil" ? 0.1 : brushSpacing / 100),
    );
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      paintStamp(context, {
        x: lastPoint.x + (point.x - lastPoint.x) * progress,
        y: lastPoint.y + (point.y - lastPoint.y) * progress,
        pressure: lastPoint.pressure + (point.pressure - lastPoint.pressure) * progress,
      });
    }

    lastPointRef.current = point;
    compositeStrokeToCanvas();
  }

  function pickColorAt(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });

    if (!canvas || !context) {
      return;
    }

    const point = getCanvasPoint(event, canvas);
    const pixel = context.getImageData(
      Math.max(0, Math.min(tileSize - 1, Math.floor(point.x))),
      Math.max(0, Math.min(tileSize - 1, Math.floor(point.y))),
      1,
      1,
    ).data;

    selectColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
    setTransferMessage("Picked colour from tile.");
  }

  function fillAt(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });

    if (!canvas || !context) {
      return;
    }

    const point = getCanvasPoint(event, canvas);
    const startX = Math.max(0, Math.min(tileSize - 1, Math.floor(point.x)));
    const startY = Math.max(0, Math.min(tileSize - 1, Math.floor(point.y)));
    const imageData = context.getImageData(0, 0, tileSize, tileSize);
    const { data } = imageData;
    const targetOffset = getPixelOffset(startX, startY, tileSize);
    const targetColor = {
      red: data[targetOffset],
      green: data[targetOffset + 1],
      blue: data[targetOffset + 2],
      alpha: data[targetOffset + 3],
    };
    const fillColor = hexToRgb(selectedColor);

    if (
      colorMatches(
        data,
        targetOffset,
        { ...fillColor, alpha: 255 },
        fillTolerance,
      )
    ) {
      return;
    }

    pushUndoState();

    function setPixel(offset: number) {
      data[offset] = fillColor.red;
      data[offset + 1] = fillColor.green;
      data[offset + 2] = fillColor.blue;
      data[offset + 3] = 255;
    }

    if (fillMode === "global") {
      for (let offset = 0; offset < data.length; offset += 4) {
        if (colorMatches(data, offset, targetColor, fillTolerance)) {
          setPixel(offset);
        }
      }
    } else {
      const visited = new Uint8Array(tileSize * tileSize);
      const queue: CanvasPoint[] = [{ x: startX, y: startY }];

      while (queue.length > 0) {
        const nextPoint = queue.pop();

        if (!nextPoint) {
          continue;
        }

        const pixelIndex = nextPoint.y * tileSize + nextPoint.x;

        if (visited[pixelIndex]) {
          continue;
        }

        visited[pixelIndex] = 1;

        const offset = getPixelOffset(nextPoint.x, nextPoint.y, tileSize);

        if (!colorMatches(data, offset, targetColor, fillTolerance)) {
          continue;
        }

        setPixel(offset);

        queue.push(
          { x: (nextPoint.x + 1) % tileSize, y: nextPoint.y },
          { x: (nextPoint.x - 1 + tileSize) % tileSize, y: nextPoint.y },
          { x: nextPoint.x, y: (nextPoint.y + 1) % tileSize },
          { x: nextPoint.x, y: (nextPoint.y - 1 + tileSize) % tileSize },
        );
      }
    }

    context.putImageData(imageData, 0, 0);
    renderPatternPreviews();
  }

  function constrainLineEnd(start: CanvasPoint, current: CanvasPoint) {
    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;
    const angle = Math.atan2(deltaY, deltaX);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const distance = Math.hypot(deltaX, deltaY);

    return {
      x: start.x + Math.cos(snappedAngle) * distance,
      y: start.y + Math.sin(snappedAngle) * distance,
    };
  }

  function getShapeGeometry(draft: ShapeDraft) {
    const start = draft.start;
    const end = draft.constrain && shapeKind === "line"
      ? constrainLineEnd(start, draft.current)
      : draft.current;
    let x = Math.min(start.x, end.x);
    let y = Math.min(start.y, end.y);
    let width = Math.abs(end.x - start.x);
    let height = Math.abs(end.y - start.y);

    if (shapeKind !== "line" && draft.constrain) {
      const size = Math.max(width, height);
      width = size;
      height = size;
      x = end.x < start.x ? start.x - size : start.x;
      y = end.y < start.y ? start.y - size : start.y;
    }

    if (shapeKind !== "line" && draft.fromCenter) {
      x = start.x - width;
      y = start.y - height;
      width *= 2;
      height *= 2;
    }

    return {
      end,
      height,
      start,
      width,
      x,
      y,
    };
  }

  function drawShapePath(
    context: CanvasRenderingContext2D,
    draft: ShapeDraft,
    offsetX: number,
    offsetY: number,
  ) {
    const shape = getShapeGeometry(draft);

    context.beginPath();

    if (shapeKind === "line") {
      context.moveTo(shape.start.x + offsetX, shape.start.y + offsetY);
      context.lineTo(shape.end.x + offsetX, shape.end.y + offsetY);
      return;
    }

    if (shapeKind === "ellipse") {
      context.ellipse(
        shape.x + shape.width / 2 + offsetX,
        shape.y + shape.height / 2 + offsetY,
        Math.max(0.5, shape.width / 2),
        Math.max(0.5, shape.height / 2),
        0,
        0,
        Math.PI * 2,
      );
      return;
    }

    context.rect(shape.x + offsetX, shape.y + offsetY, shape.width, shape.height);
  }

  function commitShape(draft: ShapeDraft) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    disableCanvasSmoothing(context);
    context.save();
    context.globalAlpha = brushOpacity / 100;
    context.globalCompositeOperation = shapeBlendMode === "erase" ? "destination-out" : "source-over";
    context.fillStyle = selectedColor;
    context.strokeStyle = selectedColor;
    context.lineWidth = Math.max(1, brushSize);
    context.lineCap = shapeKind === "line" ? "round" : "square";
    context.lineJoin = "round";

    for (const offsetX of [-tileSize, 0, tileSize]) {
      for (const offsetY of [-tileSize, 0, tileSize]) {
        drawShapePath(context, draft, offsetX, offsetY);

        if (shapeKind !== "line" && (shapeMode === "fill" || shapeMode === "stroke-and-fill")) {
          context.fill();
        }

        if (shapeKind === "line" || shapeMode === "stroke" || shapeMode === "stroke-and-fill") {
          context.stroke();
        }
      }
    }

    context.restore();
    renderPatternPreviews();
  }

  function updateBrushPreview(event: PointerEvent<HTMLCanvasElement>) {
    setBrushPreviewPoint(getCanvasPoint(event, event.currentTarget));

    if (selectedTool !== "eyedropper") {
      return;
    }

    const context = event.currentTarget.getContext("2d", { willReadFrequently: true });

    if (!context) {
      return;
    }

    const point = getCanvasPoint(event, event.currentTarget);
    const pixel = context.getImageData(
      Math.max(0, Math.min(tileSize - 1, Math.floor(point.x))),
      Math.max(0, Math.min(tileSize - 1, Math.floor(point.y))),
      1,
      1,
    ).data;

    setHoverSampleColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateBrushPreview(event);

    if (selectedTool === "eyedropper") {
      pickColorAt(event);
      return;
    }

    if (selectedTool === "fill") {
      fillAt(event);
      return;
    }

    if (selectedTool === "shape") {
      const point = getCanvasPoint(event, event.currentTarget);
      const nextDraft = {
        constrain: event.shiftKey,
        current: point,
        fromCenter: event.altKey,
        start: point,
      };

      pushUndoState();
      updateShapeDraft(nextDraft);
      return;
    }

    pushUndoState();
    const baseSnapshot = captureCanvasState();
    const strokeCanvas = document.createElement("canvas");
    const strokeContext = strokeCanvas.getContext("2d");

    if (!baseSnapshot || !strokeContext) {
      return;
    }

    strokeCanvas.width = tileSize;
    strokeCanvas.height = tileSize;
    disableCanvasSmoothing(strokeContext);
    strokeBaseRef.current = baseSnapshot;
    strokeCanvasRef.current = strokeCanvas;
    strokeContextRef.current = strokeContext;
    isPaintingRef.current = true;
    lastPointRef.current = null;
    paintAt(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    updateBrushPreview(event);

    if (shapeDraftRef.current) {
      updateShapeDraft({
        ...shapeDraftRef.current,
        constrain: event.shiftKey,
        current: getCanvasPoint(event, event.currentTarget),
        fromCenter: event.altKey,
      });
      return;
    }

    if (isPaintingRef.current) {
      paintAt(event);
    }
  }

  function stopPainting(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const activeShapeDraft = shapeDraftRef.current;

    if (activeShapeDraft) {
      commitShape(activeShapeDraft);
      updateShapeDraft(null);
      writePatternMakerDraft();
      return;
    }

    isPaintingRef.current = false;
    lastPointRef.current = null;
    compositeStrokeToCanvas();
    strokeBaseRef.current = null;
    strokeCanvasRef.current = null;
    strokeContextRef.current = null;
    writePatternMakerDraft();
  }

  function handlePointerLeave(event: PointerEvent<HTMLCanvasElement>) {
    stopPainting(event);
    setBrushPreviewPoint(null);
  }

  function handleUseInGenerator() {
    const canvas = paintCanvasRef.current;

    if (!canvas) {
      return;
    }

    writeStoredGeneratorPattern(canvas.toDataURL("image/png"));
    navigate("/generator");
  }

  function handleExportPattern() {
    const canvas = paintCanvasRef.current;

    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "magiceyelab-pattern.png";
    link.click();
  }

  async function handleImportPattern(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!acceptedPatternTypes.has(file.type)) {
      setTransferMessage("Choose a PNG, JPEG, or WebP image.");
      return;
    }

    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    try {
      const image = await loadImageFile(file);
      pushUndoState();
      context.fillStyle = "#f7f5ef";
      context.fillRect(0, 0, tileSize, tileSize);
      context.drawImage(image, 0, 0, tileSize, tileSize);
      renderPatternPreviews();
      setTransferMessage(`Imported ${file.name}.`);
    } catch {
      setTransferMessage("Could not import that pattern image.");
    }
  }

  async function handleLoadGeneratorPattern() {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");
    const storedPattern = readStoredGeneratorState().patternImageDataUrl;

    if (!canvas || !context || !storedPattern) {
      setTransferMessage("No generator pattern to load.");
      return;
    }

    try {
      const image = await loadImageSource(storedPattern);
      pushUndoState();
      context.fillStyle = "#f7f5ef";
      context.fillRect(0, 0, tileSize, tileSize);
      context.drawImage(image, 0, 0, tileSize, tileSize);
      renderPatternPreviews();
      setTransferMessage("Loaded generator pattern.");
    } catch {
      setTransferMessage("Could not load generator pattern.");
    }
  }

  function handleRandomPattern() {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    pushUndoState();
    context.fillStyle = "#f7f5ef";
    context.fillRect(0, 0, tileSize, tileSize);

    context.lineCap = "round";
    context.lineJoin = "round";

    for (let index = 0; index < 22; index += 1) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const startX = Math.random() * tileSize;
      const startY = Math.random() * tileSize;
      const length = 80 + Math.random() * 180;
      const angle = Math.random() * Math.PI * 2;

      context.strokeStyle = color;
      context.lineWidth = 10 + Math.random() * 26;
      drawWrappedLine(
        context,
        startX,
        startY,
        startX + Math.cos(angle) * length,
        startY + Math.sin(angle) * length,
      );
    }

    for (let index = 0; index < 72; index += 1) {
      context.fillStyle = palette[index % palette.length];
      drawWrappedCircle(
        context,
        Math.random() * tileSize,
        Math.random() * tileSize,
        8 + Math.random() * 28,
      );
    }

    renderPatternPreviews();
  }

  function handleClearTile() {
    clearTile();
    setTransferMessage("Cleared pattern tile.");
  }

  function handleUndo() {
    const snapshot = undoStackRef.current.at(-1);
    const currentSnapshot = captureCanvasState();

    if (!snapshot || !currentSnapshot) {
      return;
    }

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, currentSnapshot].slice(
      -maxHistoryStates,
    );
    restoreCanvasState(snapshot);
    syncHistoryState();
  }

  function handleRedo() {
    const snapshot = redoStackRef.current.at(-1);
    const currentSnapshot = captureCanvasState();

    if (!snapshot || !currentSnapshot) {
      return;
    }

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, currentSnapshot].slice(
      -maxHistoryStates,
    );
    restoreCanvasState(snapshot);
    syncHistoryState();
  }

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() !== "z") {
          return;
        }

        event.preventDefault();

        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }

        return;
      }

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const shortcutTool = {
        b: "brush",
        e: "eraser",
        f: "fill",
        i: "eyedropper",
        p: "pencil",
        s: "shape",
      }[event.key.toLowerCase()] as PatternTool | undefined;

      if (shortcutTool) {
        event.preventDefault();
        setSelectedTool(shortcutTool);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  });

  useEffect(() => {
    schedulePatternMakerDraftSave();
  });

  useEffect(() => {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.fillStyle = "#f7f5ef";
    context.fillRect(0, 0, tileSize, tileSize);

    const storedPattern =
      storedPatternMakerState.imageDataUrl || readStoredGeneratorState().patternImageDataUrl;

    if (!storedPattern) {
      renderPatternPreviews();
      hasRestoredDraftRef.current = true;
      return;
    }

    let isCurrent = true;

    void loadImageSource(storedPattern)
      .then((image) => {
        if (!isCurrent) {
          return;
        }

        context.drawImage(image, 0, 0, tileSize, tileSize);
        renderPatternPreviews();
        hasRestoredDraftRef.current = true;
      })
      .catch(() => {
        renderPatternPreviews();
        hasRestoredDraftRef.current = true;
      });

    return () => {
      isCurrent = false;
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
        draftSaveTimeoutRef.current = null;
      }
      writePatternMakerDraft();
    };
    // Restore the draft once on page entry; the helpers above intentionally read current refs/state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedPatternMakerState.imageDataUrl]);

  useEffect(() => {
    const repeatPreview = repeatPreviewRef.current;

    if (!repeatPreview) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", renderPatternPreviews);

      return () => window.removeEventListener("resize", renderPatternPreviews);
    }

    const resizeObserver = new ResizeObserver(renderPatternPreviews);
    resizeObserver.observe(repeatPreview);

    return () => resizeObserver.disconnect();
    // Resize observation should be registered once for this canvas instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBrushShape = getActiveBrushShape();
  const usesBrushStamp = ["brush", "eraser", "pencil"].includes(selectedTool);
  const usesSoftBrushControls = selectedTool === "brush" || selectedTool === "eraser";
  const usesBrushShapeControl = selectedTool === "brush" || selectedTool === "eraser";
  const usesFillControls = selectedTool === "fill";
  const usesShapeControls = selectedTool === "shape";
  const usesPaletteControls = selectedTool !== "eraser" &&
    !(selectedTool === "shape" && shapeBlendMode === "erase");
  const implementControlLabel = selectedTool === "eraser" ? "Eraser" : "Brush";
  const activeCursorColor = selectedTool === "eyedropper"
    ? hoverSampleColor
    : selectedTool === "eraser" || (selectedTool === "shape" && shapeBlendMode === "erase")
      ? "#f7f5ef"
      : selectedColor;
  const cursorIconPath = selectedTool === "eyedropper"
    ? mdiEyedropper
    : selectedTool === "fill"
      ? mdiFormatColorFill
      : selectedTool === "shape"
        ? mdiVectorSquare
        : null;
  const implementDemoStyle: ImplementDemoStyle = {
    "--implement-demo-color": activeCursorColor,
    "--implement-demo-hardness": selectedTool === "pencil" ? "100%" : `${brushHardness}%`,
    "--implement-demo-opacity": selectedTool === "pencil" ? 1 : brushOpacity / 100,
    "--implement-demo-size": `${Math.max(8, brushSize)}px`,
  };
  const brushCursorStyle: BrushCursorStyle | undefined = brushPreviewPoint && selectedTool !== "shape"
    ? {
        "--brush-cursor-color": activeCursorColor,
        "--brush-cursor-size": `${(brushSize / tileSize) * 100}%`,
        "--brush-cursor-x": `${(brushPreviewPoint.x / tileSize) * 100}%`,
        "--brush-cursor-y": `${(brushPreviewPoint.y / tileSize) * 100}%`,
      }
    : undefined;
  const shapePreview = shapeDraft ? getShapeGeometry(shapeDraft) : null;

  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="Pattern Maker"
        title="Build seamless repeating tiles"
        description="Draw a compact pattern tile, preview its repeat, and feed it into the stereogram generator."
      />

      <div className={styles.workspaceGrid}>
        <aside className={styles.toolPanel} aria-label="Pattern maker controls">
          <FieldGroup title="Paint">
            <div className={styles.panelHeader}>
              <span className={styles.panelSubheading}>Tools</span>
              <div className={styles.iconRow} aria-label="Pattern history">
                <button type="button" aria-label="Undo" disabled={!canUndo} onClick={handleUndo}>
                  <MdiIcon path={mdiUndo} />
                </button>
                <button type="button" aria-label="Redo" disabled={!canRedo} onClick={handleRedo}>
                  <MdiIcon path={mdiRedo} />
                </button>
              </div>
            </div>
            <div className={styles.segmentedControl} aria-label="Pattern tool">
              <button
                type="button"
                aria-pressed={selectedTool === "pencil"}
                onClick={() => setSelectedTool("pencil")}
              >
                <MdiIcon path={mdiPencil} />
                Pencil
              </button>
              <button
                type="button"
                aria-pressed={selectedTool === "brush"}
                onClick={() => setSelectedTool("brush")}
              >
                <MdiIcon path={mdiBrush} />
                Brush
              </button>
              <button
                type="button"
                aria-pressed={selectedTool === "eraser"}
                onClick={() => setSelectedTool("eraser")}
              >
                <MdiIcon path={mdiEraser} />
                Eraser
              </button>
              <button
                type="button"
                aria-pressed={selectedTool === "eyedropper"}
                onClick={() => setSelectedTool("eyedropper")}
              >
                <MdiIcon path={mdiEyedropper} />
                Pick
              </button>
              <button
                type="button"
                aria-pressed={selectedTool === "fill"}
                onClick={() => setSelectedTool("fill")}
              >
                <MdiIcon path={mdiFormatColorFill} />
                Fill
              </button>
              <button
                type="button"
                aria-pressed={selectedTool === "shape"}
                onClick={() => setSelectedTool("shape")}
              >
                <MdiIcon path={mdiVectorSquare} />
                Shape
              </button>
            </div>

            <div className={styles.panelBlock}>
              <span className={styles.panelSubheading}>Preview</span>
              <div
                className={styles.implementDemo}
                aria-label={`${selectedTool} implement preview`}
                style={implementDemoStyle}
              >
                <span className={styles.implementDemoText}>
                  <strong>{selectedTool}</strong>
                  <span>
                    {usesBrushStamp
                      ? `${brushSize}px ${activeBrushShape}${usesSoftBrushControls ? ` / ${brushFlow}% flow` : ""}`
                      : selectedTool === "fill"
                        ? `${fillMode} fill / tolerance ${fillTolerance}`
                        : selectedTool === "shape"
                          ? `${shapeBlendMode} ${shapeMode} ${shapeKind}`
                          : "sample exact pixel colour"}
                  </span>
                </span>
                <span
                  className={classNames(styles.implementDemoPad, {
                    [styles.strokeImplementDemo]: usesBrushStamp,
                    [styles.squareStrokeDemo]: usesBrushStamp && activeBrushShape === "square",
                    [styles.eraserStrokeDemo]: selectedTool === "eraser",
                    [styles.fillImplementDemo]: selectedTool === "fill",
                    [styles.pickerImplementDemo]: selectedTool === "eyedropper",
                  })}
                  aria-hidden="true"
                >
                  {usesBrushStamp ? (
                    <>
                      {Array.from({ length: 7 }, (_, index) => (
                        <span className={styles.demoStamp} key={index} />
                      ))}
                    </>
                  ) : cursorIconPath ? (
                    <MdiIcon path={cursorIconPath} />
                  ) : null}
                </span>
              </div>
            </div>

            {usesBrushStamp ? (
              <div className={styles.panelBlock}>
                <span className={styles.panelSubheading}>
                  {selectedTool === "pencil" ? "Pencil Settings" : `${implementControlLabel} Settings`}
                </span>
                <label className={styles.rangeField}>
                  <span className={styles.rangeLabel}>
                    <span>Size</span>
                    <output>{brushSize}px</output>
                  </span>
                  <input
                    type="range"
                    aria-label={
                      selectedTool === "pencil"
                        ? "Pencil size"
                        : `${implementControlLabel} size`
                    }
                    min="1"
                    max="96"
                    value={brushSize}
                    onChange={(event) => setBrushSize(Number(event.target.value))}
                  />
                </label>
                {usesSoftBrushControls ? (
                  <>
                    <label className={styles.rangeField}>
                      <span className={styles.rangeLabel}>
                        <span>Opacity</span>
                        <output>{brushOpacity}%</output>
                      </span>
                      <input
                        type="range"
                        aria-label={`${implementControlLabel} opacity`}
                        min="10"
                        max="100"
                        value={brushOpacity}
                        onChange={(event) => setBrushOpacity(Number(event.target.value))}
                      />
                    </label>
                    <label className={styles.rangeField}>
                      <span className={styles.rangeLabel}>
                        <span>Flow</span>
                        <output>{brushFlow}%</output>
                      </span>
                      <input
                        type="range"
                        aria-label={`${implementControlLabel} flow`}
                        min="1"
                        max="100"
                        value={brushFlow}
                        onChange={(event) => setBrushFlow(Number(event.target.value))}
                      />
                    </label>
                    <label className={styles.rangeField}>
                      <span className={styles.rangeLabel}>
                        <span>Hardness</span>
                        <output>{brushHardness}%</output>
                      </span>
                      <input
                        type="range"
                        aria-label={`${implementControlLabel} hardness`}
                        min="0"
                        max="100"
                        value={brushHardness}
                        onChange={(event) => setBrushHardness(Number(event.target.value))}
                      />
                    </label>
                    <label className={styles.rangeField}>
                      <span className={styles.rangeLabel}>
                        <span>Spacing</span>
                        <output>{brushSpacing}%</output>
                      </span>
                      <input
                        type="range"
                        aria-label={`${implementControlLabel} spacing`}
                        min="5"
                        max="100"
                        value={brushSpacing}
                        onChange={(event) => setBrushSpacing(Number(event.target.value))}
                      />
                    </label>
                  </>
                ) : null}
                {usesBrushShapeControl ? (
                  <div className={styles.shapeControl} aria-label={`${implementControlLabel} shape`}>
                    <button
                      type="button"
                      aria-pressed={brushShape === "circle"}
                      onClick={() => setBrushShape("circle")}
                    >
                      <MdiIcon path={mdiShapeCirclePlus} />
                      Circle
                    </button>
                    <button
                      type="button"
                      aria-pressed={brushShape === "square"}
                      onClick={() => setBrushShape("square")}
                    >
                      <MdiIcon path={mdiShapeSquarePlus} />
                      Square
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {usesFillControls ? (
              <div className={styles.panelBlock}>
                <span className={styles.panelSubheading}>Fill Settings</span>
                <div className={styles.shapeControl} aria-label="Fill mode">
                  <button
                    type="button"
                    aria-pressed={fillMode === "contiguous"}
                    onClick={() => setFillMode("contiguous")}
                  >
                    <MdiIcon path={mdiFormatColorFill} />
                    Contiguous
                  </button>
                  <button
                    type="button"
                    aria-pressed={fillMode === "global"}
                    onClick={() => setFillMode("global")}
                  >
                    <MdiIcon path={mdiSwapHorizontal} />
                    Global
                  </button>
                </div>
                <label className={styles.rangeField}>
                  <span className={styles.rangeLabel}>
                    <span>Fill tolerance</span>
                    <output>{fillTolerance}</output>
                  </span>
                  <input
                    type="range"
                    aria-label="Fill tolerance"
                    min="0"
                    max="64"
                    value={fillTolerance}
                    onChange={(event) => setFillTolerance(Number(event.target.value))}
                  />
                </label>
              </div>
            ) : null}

            {usesShapeControls ? (
              <div className={styles.panelBlock}>
                <span className={styles.panelSubheading}>Shape Settings</span>
                <div className={styles.shapeControl} aria-label="Shape kind">
                  <button
                    type="button"
                    aria-pressed={shapeKind === "line"}
                    onClick={() => setShapeKind("line")}
                  >
                    <MdiIcon path={mdiVectorLine} />
                    Line
                  </button>
                  <button
                    type="button"
                    aria-pressed={shapeKind === "rectangle"}
                    onClick={() => setShapeKind("rectangle")}
                  >
                    <MdiIcon path={mdiVectorSquare} />
                    Rectangle
                  </button>
                  <button
                    type="button"
                    aria-pressed={shapeKind === "ellipse"}
                    onClick={() => setShapeKind("ellipse")}
                  >
                    <MdiIcon path={mdiShapeCirclePlus} />
                    Ellipse
                  </button>
                </div>
                <div className={styles.shapeControl} aria-label="Shape mode">
                  <button
                    type="button"
                    aria-pressed={shapeMode === "stroke"}
                    onClick={() => setShapeMode("stroke")}
                  >
                    Stroke
                  </button>
                  <button
                    type="button"
                    aria-pressed={shapeMode === "fill"}
                    onClick={() => setShapeMode("fill")}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    aria-pressed={shapeMode === "stroke-and-fill"}
                    onClick={() => setShapeMode("stroke-and-fill")}
                  >
                    Both
                  </button>
                </div>
                <div className={styles.shapeControl} aria-label="Shape blend">
                  <button
                    type="button"
                    aria-pressed={shapeBlendMode === "paint"}
                    onClick={() => setShapeBlendMode("paint")}
                  >
                    Paint
                  </button>
                  <button
                    type="button"
                    aria-pressed={shapeBlendMode === "erase"}
                    onClick={() => setShapeBlendMode("erase")}
                  >
                    Erase
                  </button>
                </div>
                <label className={styles.rangeField}>
                  <span className={styles.rangeLabel}>
                    <span>Stroke width</span>
                    <output>{brushSize}px</output>
                  </span>
                  <input
                    type="range"
                    aria-label="Shape stroke width"
                    min="1"
                    max="96"
                    value={brushSize}
                    onChange={(event) => setBrushSize(Number(event.target.value))}
                  />
                </label>
                <label className={styles.rangeField}>
                  <span className={styles.rangeLabel}>
                    <span>Opacity</span>
                    <output>{brushOpacity}%</output>
                  </span>
                  <input
                    type="range"
                    aria-label="Shape opacity"
                    min="10"
                    max="100"
                    value={brushOpacity}
                    onChange={(event) => setBrushOpacity(Number(event.target.value))}
                  />
                </label>
              </div>
            ) : null}

            {selectedTool === "eyedropper" ? (
              <div className={styles.panelBlock}>
                <p className={styles.transferMessage}>Click the tile to sample a colour.</p>
              </div>
            ) : null}
          </FieldGroup>

          <FieldGroup title="Colour & View">
            {usesPaletteControls ? (
              <div className={styles.panelBlock}>
                <span className={styles.panelSubheading}>Palette</span>
                <label className={styles.colorField}>
                  <span>Colour</span>
                  <span className={styles.colorInputGroup}>
                    <span
                      className={styles.currentColor}
                      style={{ backgroundColor: selectedColor }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      aria-label="Current colour hex"
                      value={colorInputValue}
                      onChange={(event) => {
                        setColorInputValue(event.target.value);

                        if (normaliseHexColor(event.target.value)) {
                          selectColor(event.target.value);
                        }
                      }}
                      onBlur={() => setColorInputValue(selectedColor)}
                    />
                  </span>
                </label>
                <div className={styles.paletteRow}>
                  {palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Select ${color}`}
                      aria-pressed={selectedColor === color}
                      onClick={() => selectColor(color)}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {recentColors.length > 0 ? (
                  <div className={styles.paletteRow} aria-label="Recent colours">
                    {recentColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Select recent ${color}`}
                        aria-pressed={selectedColor === color}
                        onClick={() => selectColor(color)}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                ) : null}
                <button type="button">
                  <MdiIcon path={mdiPalette} />
                  Edit palette
                </button>
              </div>
            ) : null}

            <div className={styles.panelBlock}>
              <span className={styles.panelSubheading}>View</span>
              <label className={styles.toggleField}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(event) => setShowGrid(event.target.checked)}
                />
                <span className={styles.toggleSwitch} aria-hidden="true" />
                <span className={styles.toggleLabel}>
                  <MdiIcon path={mdiGrid} />
                  Show grid
                </span>
              </label>
              <label className={styles.toggleField}>
                <input
                  type="checkbox"
                  checked={showTileBoundary}
                  onChange={(event) => setShowTileBoundary(event.target.checked)}
                />
                <span className={styles.toggleSwitch} aria-hidden="true" />
                <span className={styles.toggleLabel}>
                  <MdiIcon path={mdiVectorSquare} />
                  Show boundary
                </span>
              </label>
            </div>
          </FieldGroup>

          <FieldGroup title="Pattern">
            <div className={styles.panelBlock}>
              <span className={styles.panelSubheading}>Tile Actions</span>
              <div className={styles.actionStack}>
                <button type="button" onClick={handleRandomPattern}>
                  <MdiIcon path={mdiDiceMultiple} />
                  Random pattern
                </button>
                <input
                  ref={importInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImportPattern}
                />
                <button type="button" onClick={() => importInputRef.current?.click()}>
                  <MdiIcon path={mdiUpload} />
                  Import PNG
                </button>
                <button type="button" onClick={handleExportPattern}>
                  <MdiIcon path={mdiDownload} />
                  Export PNG
                </button>
                <button type="button" onClick={handleClearTile}>
                  <MdiIcon path={mdiTrashCanOutline} />
                  Clear tile
                </button>
              </div>
            </div>

            <div className={styles.panelBlock}>
              <span className={styles.panelSubheading}>Generator</span>
              <div className={styles.actionStack}>
                <button type="button" onClick={handleLoadGeneratorPattern}>
                  <MdiIcon path={mdiImageEdit} />
                  Edit generator pattern
                </button>
                <button type="button" onClick={handleUseInGenerator}>
                  <MdiIcon path={mdiSend} />
                  Use in generator
                </button>
              </div>
              {transferMessage ? (
                <p className={styles.transferMessage}>{transferMessage}</p>
              ) : null}
            </div>
          </FieldGroup>

        </aside>

        <section
          className={classNames(styles.previewArea, styles.splitPreview)}
          aria-label="Pattern canvases"
        >
          <div className={styles.tileWorkbench}>
            <div className={styles.tileCorner} aria-hidden="true" />
            <canvas
              ref={topSeamRef}
              className={styles.topSeam}
              width={tileSize}
              height={seamSize}
              aria-hidden="true"
            />
            <div className={styles.tileCorner} aria-hidden="true" />
            <canvas
              ref={leftSeamRef}
              className={styles.leftSeam}
              width={seamSize}
              height={tileSize}
              aria-hidden="true"
            />
            <div
              className={classNames(styles.canvasCell, {
                [styles.canvasCellBoundary]: showTileBoundary,
              })}
            >
              <canvas
                ref={paintCanvasRef}
                className={styles.paintCanvas}
                width={tileSize}
                height={tileSize}
                aria-label="Pattern painting tile"
                onPointerDown={handlePointerDown}
                onPointerEnter={updateBrushPreview}
                onPointerMove={handlePointerMove}
                onPointerUp={stopPainting}
                onPointerCancel={stopPainting}
                onPointerLeave={handlePointerLeave}
              />
              {showGrid ? <div className={styles.gridOverlay} aria-hidden="true" /> : null}
              {showTileBoundary ? (
                <div className={styles.tileBoundaryOverlay} aria-hidden="true" />
              ) : null}
              {shapePreview ? (
                <svg
                  className={classNames(styles.shapePreview, {
                    [styles.eraseShapePreview]: shapeBlendMode === "erase",
                  })}
                  style={{ color: shapeBlendMode === "erase" ? "#e63946" : selectedColor }}
                  viewBox={`0 0 ${tileSize} ${tileSize}`}
                  aria-hidden="true"
                >
                  {shapeKind === "line" ? (
                    <line
                      x1={shapePreview.start.x}
                      y1={shapePreview.start.y}
                      x2={shapePreview.end.x}
                      y2={shapePreview.end.y}
                      stroke="currentColor"
                      strokeWidth={Math.max(1, brushSize)}
                    />
                  ) : shapeKind === "ellipse" ? (
                    <ellipse
                      cx={shapePreview.x + shapePreview.width / 2}
                      cy={shapePreview.y + shapePreview.height / 2}
                      rx={Math.max(0.5, shapePreview.width / 2)}
                      ry={Math.max(0.5, shapePreview.height / 2)}
                      fill={shapeMode === "stroke" ? "none" : "currentColor"}
                      stroke={shapeMode === "fill" ? "none" : "currentColor"}
                      strokeWidth={Math.max(1, brushSize)}
                    />
                  ) : (
                    <rect
                      x={shapePreview.x}
                      y={shapePreview.y}
                      width={shapePreview.width}
                      height={shapePreview.height}
                      fill={shapeMode === "stroke" ? "none" : "currentColor"}
                      stroke={shapeMode === "fill" ? "none" : "currentColor"}
                      strokeWidth={Math.max(1, brushSize)}
                    />
                  )}
                </svg>
              ) : null}
              {brushCursorStyle ? (
                <div
                  className={classNames(styles.brushCursor, {
                    [styles.squareBrushCursor]: activeBrushShape === "square",
                    [styles.eraserBrushCursor]: selectedTool === "eraser",
                    [styles.iconBrushCursor]: cursorIconPath,
                  })}
                  style={brushCursorStyle}
                  aria-hidden="true"
                >
                  {cursorIconPath ? (
                    <span className={styles.brushCursorIcon}>
                      <MdiIcon path={cursorIconPath} size={1} />
                    </span>
                  ) : null}
                  <span className={styles.brushCursorLabel}>{`${brushSize}px ${activeBrushShape}`}</span>
                </div>
              ) : null}
            </div>
            <canvas
              ref={rightSeamRef}
              className={styles.rightSeam}
              width={seamSize}
              height={tileSize}
              aria-hidden="true"
            />
            <div className={styles.tileCorner} aria-hidden="true" />
            <canvas
              ref={bottomSeamRef}
              className={styles.bottomSeam}
              width={tileSize}
              height={seamSize}
              aria-hidden="true"
            />
            <div className={styles.tileCorner} aria-hidden="true" />
          </div>
          <canvas
            ref={repeatPreviewRef}
            className={styles.repeatPreview}
            width={tileSize}
            height={tileSize}
            aria-label="Seamless pattern preview"
          />
        </section>
      </div>
    </div>
  );
}
