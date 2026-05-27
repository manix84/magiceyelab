import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import {
  mdiBrush,
  mdiDownload,
  mdiEraser,
  mdiFormatColorFill,
  mdiGrid,
  mdiRedo,
  mdiSend,
  mdiTrashCanOutline,
  mdiUndo,
  mdiUpload,
} from "@mdi/js";
import { useNavigate } from "react-router-dom";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { PanelSection } from "../../components/controls/PanelSection";
import { RangeField } from "../../components/controls/RangeField";
import { ToggleField } from "../../components/controls/ToggleField";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";
import { loadImageFile } from "../../lib/image/loadImageFile";
import { storageKeys } from "../../lib/storage/keys";
import styles from "./DepthPainterPage.module.scss";

const canvasSize = 512;
const neutralDepth = 128;
const maxHistoryStates = 24;
const acceptedDepthTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type DepthTool = "brush" | "eraser" | "fill";
type CanvasPoint = {
  x: number;
  y: number;
};
type StoredDepthPainterState = {
  version: 1;
  selectedTool: DepthTool;
  brushSize: number;
  brushOpacity: number;
  depthValue: number;
  fillTolerance: number;
  showGrid: boolean;
  imageDataUrl: string;
};
type StoredDepthPainterControls = Omit<StoredDepthPainterState, "imageDataUrl" | "version">;
type StoredGeneratorState = {
  version: 1;
  exportName: string;
  depthStrength: number;
  repeatWidth: number;
  animationEnabled?: boolean;
  animationSpeed?: number;
  showDepthOverlay: boolean;
  depthFileName: string;
  depthInferenceMessage: string;
  depthImageDataUrl: string;
  patternFileName: string;
  patternImageDataUrl: string;
};
type BrushCursorStyle = CSSProperties & {
  "--brush-cursor-size": string;
  "--brush-cursor-x": string;
  "--brush-cursor-y": string;
};

const defaultDepthPainterState: StoredDepthPainterState = {
  version: 1,
  selectedTool: "brush",
  brushSize: 32,
  brushOpacity: 100,
  depthValue: 180,
  fillTolerance: 8,
  showGrid: true,
  imageDataUrl: "",
};
const defaultGeneratorState: StoredGeneratorState = {
  version: 1,
  exportName: "",
  depthStrength: 45,
  repeatWidth: 120,
  animationEnabled: false,
  animationSpeed: 32,
  showDepthOverlay: false,
  depthFileName: "",
  depthInferenceMessage: "",
  depthImageDataUrl: "",
  patternFileName: "",
  patternImageDataUrl: "",
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function getDepthColor(depthValue: number) {
  const channel = Math.round(clampNumber(depthValue, 0, 255, neutralDepth));

  return `rgb(${channel} ${channel} ${channel})`;
}

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

function getPixelOffset(x: number, y: number) {
  return (y * canvasSize + x) * 4;
}

function colourMatches(
  data: Uint8ClampedArray,
  offset: number,
  target: number,
  tolerance: number,
) {
  const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;

  return Math.abs(luminance - target) <= tolerance;
}

function disableCanvasSmoothing(context: CanvasRenderingContext2D) {
  context.imageSmoothingEnabled = false;
}

function loadImageSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not restore stored image."));
    image.src = source;
  });
}

function readStoredDepthPainterState(): StoredDepthPainterState {
  try {
    const storedValue = window.localStorage.getItem(storageKeys.depthPainter);

    if (!storedValue) {
      return defaultDepthPainterState;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredDepthPainterState>;

    return {
      version: 1,
      selectedTool: ["brush", "eraser", "fill"].includes(parsedValue.selectedTool ?? "")
        ? parsedValue.selectedTool as DepthTool
        : defaultDepthPainterState.selectedTool,
      brushSize: clampNumber(
        parsedValue.brushSize,
        1,
        128,
        defaultDepthPainterState.brushSize,
      ),
      brushOpacity: clampNumber(
        parsedValue.brushOpacity,
        10,
        100,
        defaultDepthPainterState.brushOpacity,
      ),
      depthValue: clampNumber(
        parsedValue.depthValue,
        0,
        255,
        defaultDepthPainterState.depthValue,
      ),
      fillTolerance: clampNumber(
        parsedValue.fillTolerance,
        0,
        64,
        defaultDepthPainterState.fillTolerance,
      ),
      showGrid: parsedValue.showGrid !== false,
      imageDataUrl:
        typeof parsedValue.imageDataUrl === "string" ? parsedValue.imageDataUrl : "",
    };
  } catch {
    return defaultDepthPainterState;
  }
}

function readStoredGeneratorState(): StoredGeneratorState {
  try {
    const storedValue = window.localStorage.getItem(storageKeys.generator);

    if (!storedValue) {
      return defaultGeneratorState;
    }

    return {
      ...defaultGeneratorState,
      ...(JSON.parse(storedValue) as Partial<StoredGeneratorState>),
      version: 1,
    };
  } catch {
    return defaultGeneratorState;
  }
}

function writeStoredGeneratorDepth(depthImageDataUrl: string) {
  const storedGeneratorState = readStoredGeneratorState();

  window.localStorage.setItem(
    storageKeys.generator,
    JSON.stringify({
      ...storedGeneratorState,
      version: 1,
      depthFileName: "depth-painter-map.png",
      depthInferenceMessage: "Painted depth map from Depth Painter.",
      depthImageDataUrl,
    }),
  );
}

export function DepthPainterPage() {
  const navigate = useNavigate();
  const [storedDepthPainterState] = useState(readStoredDepthPainterState);
  const [selectedTool, setSelectedTool] = useState<DepthTool>(
    storedDepthPainterState.selectedTool,
  );
  const [brushSize, setBrushSize] = useState(storedDepthPainterState.brushSize);
  const [brushOpacity, setBrushOpacity] = useState(
    storedDepthPainterState.brushOpacity,
  );
  const [depthValue, setDepthValue] = useState(storedDepthPainterState.depthValue);
  const [fillTolerance, setFillTolerance] = useState(
    storedDepthPainterState.fillTolerance,
  );
  const [showGrid, setShowGrid] = useState(storedDepthPainterState.showGrid);
  const [transferMessage, setTransferMessage] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [brushPreviewPoint, setBrushPreviewPoint] = useState<CanvasPoint | null>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef<CanvasPoint | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const hasRestoredDraftRef = useRef(false);
  const handleRedoRef = useRef<() => void>(() => undefined);
  const handleUndoRef = useRef<() => void>(() => undefined);
  const depthPainterControlsRef = useRef<StoredDepthPainterControls>({
    selectedTool: storedDepthPainterState.selectedTool,
    brushSize: storedDepthPainterState.brushSize,
    brushOpacity: storedDepthPainterState.brushOpacity,
    depthValue: storedDepthPainterState.depthValue,
    fillTolerance: storedDepthPainterState.fillTolerance,
    showGrid: storedDepthPainterState.showGrid,
  });

  const brushCursorStyle: BrushCursorStyle | undefined = brushPreviewPoint
    ? {
        "--brush-cursor-size": `${(brushSize / canvasSize) * 100}%`,
        "--brush-cursor-x": `${(brushPreviewPoint.x / canvasSize) * 100}%`,
        "--brush-cursor-y": `${(brushPreviewPoint.y / canvasSize) * 100}%`,
      }
    : undefined;

  const writeDepthPainterDraft = useCallback(() => {
    const canvas = paintCanvasRef.current;

    if (!canvas || !hasRestoredDraftRef.current) {
      return;
    }

    const payload: StoredDepthPainterState = {
      version: 1,
      ...depthPainterControlsRef.current,
      imageDataUrl: canvas.toDataURL("image/png"),
    };

    try {
      window.localStorage.setItem(storageKeys.depthPainter, JSON.stringify(payload));
    } catch {
      try {
        window.localStorage.setItem(
          storageKeys.depthPainter,
          JSON.stringify({ ...payload, imageDataUrl: "" }),
        );
      } catch {
        window.localStorage.removeItem(storageKeys.depthPainter);
      }
    }
  }, []);

  const scheduleDepthPainterDraftSave = useCallback(() => {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = window.setTimeout(() => {
      draftSaveTimeoutRef.current = null;
      writeDepthPainterDraft();
    }, 250);
  }, [writeDepthPainterDraft]);

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

    return context.getImageData(0, 0, canvasSize, canvasSize);
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
    scheduleDepthPainterDraftSave();
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

  function drawBrushAt(point: CanvasPoint) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    disableCanvasSmoothing(context);
    context.save();
    context.globalAlpha = selectedTool === "eraser" ? 1 : brushOpacity / 100;
    context.fillStyle = selectedTool === "eraser"
      ? getDepthColor(neutralDepth)
      : getDepthColor(depthValue);
    context.beginPath();
    context.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function paintAt(event: PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event, event.currentTarget);
    const lastPoint = lastPointRef.current;

    if (!lastPoint) {
      drawBrushAt(point);
      lastPointRef.current = point;
      scheduleDepthPainterDraftSave();
      return;
    }

    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    const spacing = Math.max(1, brushSize * 0.12);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      drawBrushAt({
        x: lastPoint.x + (point.x - lastPoint.x) * progress,
        y: lastPoint.y + (point.y - lastPoint.y) * progress,
      });
    }

    lastPointRef.current = point;
    scheduleDepthPainterDraftSave();
  }

  function fillAt(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });

    if (!canvas || !context) {
      return;
    }

    const point = getCanvasPoint(event, canvas);
    const startX = Math.max(0, Math.min(canvasSize - 1, Math.floor(point.x)));
    const startY = Math.max(0, Math.min(canvasSize - 1, Math.floor(point.y)));
    const imageData = context.getImageData(0, 0, canvasSize, canvasSize);
    const { data } = imageData;
    const targetOffset = getPixelOffset(startX, startY);
    const targetDepth =
      data[targetOffset] * 0.299 +
      data[targetOffset + 1] * 0.587 +
      data[targetOffset + 2] * 0.114;
    const nextDepth = selectedTool === "eraser" ? neutralDepth : depthValue;

    if (Math.abs(targetDepth - nextDepth) <= fillTolerance) {
      return;
    }

    pushUndoState();

    const visited = new Uint8Array(canvasSize * canvasSize);
    const queue: CanvasPoint[] = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const nextPoint = queue.pop();

      if (!nextPoint) {
        continue;
      }

      const pixelIndex = nextPoint.y * canvasSize + nextPoint.x;

      if (visited[pixelIndex]) {
        continue;
      }

      visited[pixelIndex] = 1;

      const offset = getPixelOffset(nextPoint.x, nextPoint.y);

      if (!colourMatches(data, offset, targetDepth, fillTolerance)) {
        continue;
      }

      data[offset] = nextDepth;
      data[offset + 1] = nextDepth;
      data[offset + 2] = nextDepth;
      data[offset + 3] = 255;

      if (nextPoint.x > 0) {
        queue.push({ x: nextPoint.x - 1, y: nextPoint.y });
      }

      if (nextPoint.x < canvasSize - 1) {
        queue.push({ x: nextPoint.x + 1, y: nextPoint.y });
      }

      if (nextPoint.y > 0) {
        queue.push({ x: nextPoint.x, y: nextPoint.y - 1 });
      }

      if (nextPoint.y < canvasSize - 1) {
        queue.push({ x: nextPoint.x, y: nextPoint.y + 1 });
      }
    }

    context.putImageData(imageData, 0, 0);
    scheduleDepthPainterDraftSave();
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setBrushPreviewPoint(getCanvasPoint(event, event.currentTarget));

    if (selectedTool === "fill") {
      fillAt(event);
      return;
    }

    pushUndoState();
    isPaintingRef.current = true;
    lastPointRef.current = null;
    paintAt(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    setBrushPreviewPoint(getCanvasPoint(event, event.currentTarget));

    if (isPaintingRef.current) {
      paintAt(event);
    }
  }

  function stopPainting(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!isPaintingRef.current) {
      return;
    }

    isPaintingRef.current = false;
    lastPointRef.current = null;
    writeDepthPainterDraft();
  }

  function clearCanvas(pushHistory = true) {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    if (pushHistory) {
      pushUndoState();
    }

    disableCanvasSmoothing(context);
    context.fillStyle = getDepthColor(neutralDepth);
    context.fillRect(0, 0, canvasSize, canvasSize);
    scheduleDepthPainterDraftSave();
  }

  function exportDepthMap() {
    const canvas = paintCanvasRef.current;

    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "magiceyelab-depth-map.png";
    link.click();
  }

  function useInGenerator() {
    const canvas = paintCanvasRef.current;

    if (!canvas) {
      return;
    }

    writeStoredGeneratorDepth(canvas.toDataURL("image/png"));
    navigate("/generator");
  }

  async function importDepthMap(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!acceptedDepthTypes.has(file.type)) {
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
      disableCanvasSmoothing(context);
      context.fillStyle = getDepthColor(neutralDepth);
      context.fillRect(0, 0, canvasSize, canvasSize);
      context.drawImage(image, 0, 0, canvasSize, canvasSize);
      setTransferMessage(`Imported ${file.name}.`);
      scheduleDepthPainterDraftSave();
    } catch {
      setTransferMessage("Could not import that depth image.");
    }
  }

  useEffect(() => {
    handleRedoRef.current = handleRedo;
    handleUndoRef.current = handleUndo;
  });

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() !== "z") {
          return;
        }

        event.preventDefault();

        if (event.shiftKey) {
          handleRedoRef.current();
        } else {
          handleUndoRef.current();
        }

        return;
      }

      const shortcutTool = {
        b: "brush",
        e: "eraser",
        f: "fill",
      }[event.key.toLowerCase()] as DepthTool | undefined;

      if (shortcutTool) {
        event.preventDefault();
        setSelectedTool(shortcutTool);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, []);

  useEffect(() => {
    depthPainterControlsRef.current = {
      selectedTool,
      brushSize,
      brushOpacity,
      depthValue,
      fillTolerance,
      showGrid,
    };
    scheduleDepthPainterDraftSave();
  }, [
    brushOpacity,
    brushSize,
    depthValue,
    fillTolerance,
    scheduleDepthPainterDraftSave,
    selectedTool,
    showGrid,
  ]);

  useEffect(() => {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    disableCanvasSmoothing(context);
    context.fillStyle = getDepthColor(neutralDepth);
    context.fillRect(0, 0, canvasSize, canvasSize);

    if (!storedDepthPainterState.imageDataUrl) {
      hasRestoredDraftRef.current = true;
      return;
    }

    let isCurrent = true;

    void loadImageSource(storedDepthPainterState.imageDataUrl)
      .then((image) => {
        if (!isCurrent) {
          return;
        }

        context.drawImage(image, 0, 0, canvasSize, canvasSize);
        hasRestoredDraftRef.current = true;
      })
      .catch(() => {
        hasRestoredDraftRef.current = true;
      });

    return () => {
      isCurrent = false;

      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
        draftSaveTimeoutRef.current = null;
      }

      writeDepthPainterDraft();
    };
  }, [storedDepthPainterState.imageDataUrl, writeDepthPainterDraft]);

  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="Depth Painter"
        title="Paint monochrome depth maps"
        description="White areas come forward, black areas recede, and mid-gray sits between them."
      />

      <div className={styles.workspaceGrid}>
        <aside className={styles.toolPanel} aria-label="Depth painter controls">
          <FieldGroup title="Paint">
            <div className={styles.panelHeader}>
              <span className={styles.panelSubheading}>Tools</span>
              <div className={styles.iconRow} aria-label="Depth history">
                <button type="button" aria-label="Undo" disabled={!canUndo} onClick={handleUndo}>
                  <MdiIcon path={mdiUndo} />
                </button>
                <button type="button" aria-label="Redo" disabled={!canRedo} onClick={handleRedo}>
                  <MdiIcon path={mdiRedo} />
                </button>
              </div>
            </div>
            <div className={styles.segmentedControl} aria-label="Depth tool">
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
                aria-pressed={selectedTool === "fill"}
                onClick={() => setSelectedTool("fill")}
              >
                <MdiIcon path={mdiFormatColorFill} />
                Fill
              </button>
            </div>
          </FieldGroup>

          <FieldGroup title="Depth">
            <PanelSection title="Preview">
              <div className={styles.depthPreview}>
                <span
                  className={styles.depthSwatch}
                  style={{ backgroundColor: getDepthColor(depthValue) }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{depthValue}</strong>
                  <small>0 recedes / 255 comes forward</small>
                </span>
              </div>
            </PanelSection>

            <PanelSection title={selectedTool === "fill" ? "Fill Settings" : "Brush Settings"}>
              {selectedTool !== "fill" ? (
                <RangeField
                  label="Size"
                  min={1}
                  max={128}
                  value={brushSize}
                  valueLabel={`${brushSize}px`}
                  onChange={setBrushSize}
                />
              ) : null}
              {selectedTool === "brush" ? (
                <RangeField
                  label="Opacity"
                  min={10}
                  max={100}
                  value={brushOpacity}
                  valueLabel={`${brushOpacity}%`}
                  onChange={setBrushOpacity}
                />
              ) : null}
              {selectedTool !== "eraser" ? (
                <RangeField
                  label="Depth value"
                  min={0}
                  max={255}
                  value={depthValue}
                  valueLabel={depthValue}
                  onChange={setDepthValue}
                />
              ) : null}
              {selectedTool === "fill" ? (
                <RangeField
                  label="Fill tolerance"
                  min={0}
                  max={64}
                  value={fillTolerance}
                  valueLabel={fillTolerance}
                  onChange={setFillTolerance}
                />
              ) : null}
            </PanelSection>

            <PanelSection title="View">
              <ToggleField
                checked={showGrid}
                iconPath={mdiGrid}
                label="Show grid"
                onChange={setShowGrid}
              />
            </PanelSection>
          </FieldGroup>

          <FieldGroup title="Depth Map">
            <PanelSection title="Actions">
              <div className={styles.actionStack}>
                <input
                  ref={importInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  aria-label="Import depth map"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={importDepthMap}
                />
                <button type="button" onClick={() => importInputRef.current?.click()}>
                  <MdiIcon path={mdiUpload} />
                  Import depth map
                </button>
                <button type="button" onClick={exportDepthMap}>
                  <MdiIcon path={mdiDownload} />
                  Export PNG
                </button>
                <button type="button" onClick={() => {
                  clearCanvas();
                  setTransferMessage("Cleared depth map.");
                }}>
                  <MdiIcon path={mdiTrashCanOutline} />
                  Clear map
                </button>
                <button type="button" onClick={useInGenerator}>
                  <MdiIcon path={mdiSend} />
                  Use in generator
                </button>
              </div>
              {transferMessage ? (
                <p className={styles.transferMessage}>{transferMessage}</p>
              ) : null}
            </PanelSection>
          </FieldGroup>
        </aside>

        <section className={styles.previewArea} aria-label="Depth map canvas">
          <div className={styles.depthCanvasShell}>
            <canvas
              ref={paintCanvasRef}
              className={classNames(styles.depthCanvas, {
                [styles.gridCanvas]: showGrid,
              })}
              aria-label="Depth map painting canvas"
              onPointerDown={handlePointerDown}
              onPointerLeave={(event) => {
                stopPainting(event);
                setBrushPreviewPoint(null);
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={stopPainting}
            />
            {brushCursorStyle && selectedTool !== "fill" ? (
              <span
                className={classNames(styles.brushCursor, {
                  [styles.eraserCursor]: selectedTool === "eraser",
                })}
                style={brushCursorStyle}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
