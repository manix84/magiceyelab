import { useEffect, useState } from "react";
import { mdiBrush, mdiEraser, mdiRedo, mdiTrashCanOutline, mdiUndo } from "@mdi/js";
import { CanvasPlaceholder } from "../../components/canvas/CanvasPlaceholder";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";
import { storageKeys } from "../../lib/storage/keys";
import styles from "./DepthPainterPage.module.scss";

type DepthTool = "brush" | "eraser";
type StoredDepthPainterState = {
  version: 1;
  selectedTool: DepthTool;
  brushSize: number;
  depthValue: number;
};

const defaultDepthPainterState: StoredDepthPainterState = {
  version: 1,
  selectedTool: "brush",
  brushSize: 24,
  depthValue: 180,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function readStoredDepthPainterState(): StoredDepthPainterState {
  try {
    const storedValue = window.localStorage.getItem(storageKeys.depthPainter);

    if (!storedValue) {
      return defaultDepthPainterState;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredDepthPainterState>;

    return {
      version: 1 as const,
      selectedTool: parsedValue.selectedTool === "eraser" ? "eraser" : "brush",
      brushSize: clampNumber(
        parsedValue.brushSize,
        1,
        96,
        defaultDepthPainterState.brushSize,
      ),
      depthValue: clampNumber(
        parsedValue.depthValue,
        0,
        255,
        defaultDepthPainterState.depthValue,
      ),
    };
  } catch {
    return defaultDepthPainterState;
  }
}

export function DepthPainterPage() {
  const [storedDepthPainterState] = useState(readStoredDepthPainterState);
  const [selectedTool, setSelectedTool] = useState<DepthTool>(
    storedDepthPainterState.selectedTool,
  );
  const [brushSize, setBrushSize] = useState(storedDepthPainterState.brushSize);
  const [depthValue, setDepthValue] = useState(storedDepthPainterState.depthValue);

  useEffect(() => {
    const payload: StoredDepthPainterState = {
      version: 1,
      selectedTool,
      brushSize,
      depthValue,
    };

    try {
      window.localStorage.setItem(storageKeys.depthPainter, JSON.stringify(payload));
    } catch {
      window.localStorage.removeItem(storageKeys.depthPainter);
    }
  }, [brushSize, depthValue, selectedTool]);

  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="Depth Painter"
        title="Paint monochrome depth maps"
        description="White areas come forward, black areas recede, and mid-gray sits between them."
      />

      <div className={styles.workspaceGrid}>
        <aside className={styles.toolPanel} aria-label="Depth painter controls">
          <FieldGroup title="Tools">
            <div className={styles.segmentedControl} aria-label="Paint tool">
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
            </div>
          </FieldGroup>

          <FieldGroup title="Brush">
            <label>
              Size
              <input
                type="range"
                min="1"
                max="96"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
              />
            </label>
            <label>
              Depth value
              <input
                type="range"
                min="0"
                max="255"
                value={depthValue}
                onChange={(event) => setDepthValue(Number(event.target.value))}
              />
            </label>
          </FieldGroup>

          <div className={styles.iconRow} aria-label="History controls">
            <button type="button" aria-label="Undo">
              <MdiIcon path={mdiUndo} />
            </button>
            <button type="button" aria-label="Redo">
              <MdiIcon path={mdiRedo} />
            </button>
            <button type="button" aria-label="Clear canvas">
              <MdiIcon path={mdiTrashCanOutline} />
            </button>
          </div>
        </aside>

        <section className={styles.previewArea} aria-label="Depth map canvas">
          <CanvasPlaceholder label="Depth map canvas" />
        </section>
      </div>
    </div>
  );
}
