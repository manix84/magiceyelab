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
  mdiGrid,
  mdiImageEdit,
  mdiPalette,
  mdiPencil,
  mdiRedo,
  mdiSend,
  mdiShapeCirclePlus,
  mdiShapeSquarePlus,
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
const maxHistoryStates = 24;
const acceptedPatternTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
type PatternTool = "pencil" | "brush" | "eraser" | "eyedropper";
type BrushShape = "circle" | "square";
type CanvasPoint = {
  x: number;
  y: number;
};
type BrushPreviewStyle = CSSProperties & {
  "--brush-preview-size": string;
};
type BrushCursorStyle = CSSProperties & {
  "--brush-cursor-size": string;
  "--brush-cursor-x": string;
  "--brush-cursor-y": string;
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

function drawWrappedSquare(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const halfSize = size / 2;

  for (const offsetX of [-tileSize, 0, tileSize]) {
    for (const offsetY of [-tileSize, 0, tileSize]) {
      context.fillRect(
        Math.round(x + offsetX - halfSize),
        Math.round(y + offsetY - halfSize),
        size,
        size,
      );
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
  const [selectedTool, setSelectedTool] = useState<PatternTool>("brush");
  const [selectedColor, setSelectedColor] = useState(palette[0]);
  const [brushShape, setBrushShape] = useState<BrushShape>("circle");
  const [brushSize, setBrushSize] = useState(defaultBrushSize);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showTileBoundary, setShowTileBoundary] = useState(true);
  const [transferMessage, setTransferMessage] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [brushPreviewPoint, setBrushPreviewPoint] = useState<CanvasPoint | null>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const topSeamRef = useRef<HTMLCanvasElement>(null);
  const rightSeamRef = useRef<HTMLCanvasElement>(null);
  const bottomSeamRef = useRef<HTMLCanvasElement>(null);
  const leftSeamRef = useRef<HTMLCanvasElement>(null);
  const repeatPreviewRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef<CanvasPoint | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  function syncHistoryState() {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
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

  function paintStamp(context: CanvasRenderingContext2D, point: CanvasPoint) {
    context.fillStyle = selectedTool === "eraser" ? "#f7f5ef" : selectedColor;
    context.globalAlpha = selectedTool === "pencil" ? 1 : brushOpacity / 100;

    try {
      if (getActiveBrushShape() === "square") {
        drawWrappedSquare(context, point.x, point.y, brushSize);
        return;
      }

      drawWrappedCircle(context, point.x, point.y, brushSize / 2);
    } finally {
      context.globalAlpha = 1;
    }
  }

  function paintAt(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const point = getCanvasPoint(event, canvas);
    const lastPoint = lastPointRef.current;

    if (!lastPoint) {
      paintStamp(context, point);
      lastPointRef.current = point;
      renderPatternPreviews();
      return;
    }

    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    const spacing = Math.max(2, brushSize * (selectedTool === "pencil" ? 0.8 : 0.35));
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      paintStamp(context, {
        x: lastPoint.x + (point.x - lastPoint.x) * progress,
        y: lastPoint.y + (point.y - lastPoint.y) * progress,
      });
    }

    lastPointRef.current = point;
    renderPatternPreviews();
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

    setSelectedColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
    setTransferMessage("Picked colour from tile.");
  }

  function updateBrushPreview(event: PointerEvent<HTMLCanvasElement>) {
    setBrushPreviewPoint(getCanvasPoint(event, event.currentTarget));
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateBrushPreview(event);

    if (selectedTool === "eyedropper") {
      pickColorAt(event);
      return;
    }

    pushUndoState();
    isPaintingRef.current = true;
    lastPointRef.current = null;
    paintAt(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    updateBrushPreview(event);

    if (isPaintingRef.current) {
      paintAt(event);
    }
  }

  function stopPainting(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isPaintingRef.current = false;
    lastPointRef.current = null;
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
        i: "eyedropper",
        p: "pencil",
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
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.fillStyle = "#f7f5ef";
    context.fillRect(0, 0, tileSize, tileSize);

    const storedPattern = readStoredGeneratorState().patternImageDataUrl;

    if (!storedPattern) {
      renderPatternPreviews();
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
      })
      .catch(() => renderPatternPreviews());

    return () => {
      isCurrent = false;
    };
  }, []);

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
  }, []);

  const scaledBrushPreviewSize = Math.max(8, brushSize);
  const activeBrushShape = getActiveBrushShape();
  const brushPreviewStyle: BrushPreviewStyle = {
    "--brush-preview-size": `${scaledBrushPreviewSize}px`,
  };
  const brushCursorStyle: BrushCursorStyle | undefined = brushPreviewPoint
    ? {
        "--brush-cursor-size": `${(brushSize / tileSize) * 100}%`,
        "--brush-cursor-x": `${(brushPreviewPoint.x / tileSize) * 100}%`,
        "--brush-cursor-y": `${(brushPreviewPoint.y / tileSize) * 100}%`,
      }
    : undefined;
  const brushShapeClassName = classNames(styles.brushShape, {
    [styles.squareShape]: activeBrushShape === "square",
    [styles.eraserShape]: selectedTool === "eraser",
  });

  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="Pattern Maker"
        title="Build seamless repeating tiles"
        description="Draw a compact pattern tile, preview its repeat, and feed it into the stereogram generator."
      />

      <div className={styles.workspaceGrid}>
        <aside className={styles.toolPanel} aria-label="Pattern maker controls">
          <div className={styles.iconRow} aria-label="Pattern history">
            <button type="button" aria-label="Undo" disabled={!canUndo} onClick={handleUndo}>
              <MdiIcon path={mdiUndo} />
            </button>
            <button type="button" aria-label="Redo" disabled={!canRedo} onClick={handleRedo}>
              <MdiIcon path={mdiRedo} />
            </button>
          </div>

          <FieldGroup title="Tools">
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
            </div>
          </FieldGroup>

          <FieldGroup title="Brush">
            <div className={styles.brushPreview} aria-label={`${selectedTool} preview, ${brushSize}px`}>
              <span className={styles.brushPreviewLabel}>Shape</span>
              <span className={styles.brushPreviewPad} aria-hidden="true">
                <span className={brushShapeClassName} style={brushPreviewStyle} />
              </span>
            </div>
            <label className={styles.rangeField}>
              <span className={styles.rangeLabel}>
                <span>Size</span>
                <output>{brushSize}px</output>
              </span>
              <input
                type="range"
                aria-label="Brush size"
                min="4"
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
                aria-label="Brush opacity"
                min="10"
                max="100"
                value={brushOpacity}
                onChange={(event) => setBrushOpacity(Number(event.target.value))}
              />
            </label>
            <div className={styles.shapeControl} aria-label="Brush shape">
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
          </FieldGroup>

          <FieldGroup title="Palette">
            <div className={styles.paletteRow}>
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select ${color}`}
                  aria-pressed={selectedColor === color}
                  onClick={() => setSelectedColor(color)}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button type="button">
              <MdiIcon path={mdiPalette} />
              Edit palette
            </button>
          </FieldGroup>

          <button className={styles.primaryAction} type="button" onClick={handleRandomPattern}>
            <MdiIcon path={mdiDiceMultiple} />
            Random pattern
          </button>

          <FieldGroup title="Pattern File">
            <div className={styles.actionStack}>
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
          </FieldGroup>

          <FieldGroup title="Generator">
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
                onPointerMove={handlePointerMove}
                onPointerUp={stopPainting}
                onPointerCancel={stopPainting}
                onPointerLeave={handlePointerLeave}
              />
              {showGrid ? <div className={styles.gridOverlay} aria-hidden="true" /> : null}
              {showTileBoundary ? (
                <div className={styles.tileBoundaryOverlay} aria-hidden="true" />
              ) : null}
              {brushCursorStyle ? (
                <div
                  className={classNames(styles.brushCursor, {
                    [styles.squareBrushCursor]: activeBrushShape === "square",
                    [styles.eraserBrushCursor]: selectedTool === "eraser",
                  })}
                  style={brushCursorStyle}
                  aria-hidden="true"
                />
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
