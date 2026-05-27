import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import {
  mdiDownload,
  mdiMovieOpenPlayOutline,
  mdiLayersPlus,
  mdiLayersTripleOutline,
  mdiTextureBox,
} from "@mdi/js";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { RangeField } from "../../components/controls/RangeField";
import { ToggleField } from "../../components/controls/ToggleField";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";
import { supportedImageTypes } from "../import-export";
import { inferDepthMap } from "../../lib/image/inferDepthMap";
import { loadImageFile } from "../../lib/image/loadImageFile";
import { storageKeys } from "../../lib/storage/keys";
import { defaultStereogramSettings } from "../../lib/stereogram/settings";
import { renderStereogram } from "../../lib/stereogram/renderStereogram";
import styles from "./GeneratorPage.module.scss";

const maxPreviewEdge = 1200;
const maxPreviewPixels = 900_000;
const maxStoredDepthEdge = 1200;
const maxStoredPatternEdge = 512;
const exportNamePlaceholder = "magiceye_DD-MM-YYYY_hh-mm-ss.png";
type ImportSource = "depth" | "pattern";
type PreviewBounds = {
  width: number;
  height: number;
};

type StoredGeneratorState = {
  version: 1;
  exportName: string;
  depthStrength: number;
  animationEnabled: boolean;
  animationSpeed: number;
  repeatWidth: number;
  showDepthOverlay: boolean;
  depthFileName: string;
  depthInferenceMessage: string;
  depthImageDataUrl: string;
  patternFileName: string;
  patternImageDataUrl: string;
};

const defaultStoredGeneratorState: StoredGeneratorState = {
  version: 1,
  exportName: "",
  depthStrength: 45,
  animationEnabled: false,
  animationSpeed: 32,
  repeatWidth: 120,
  showDepthOverlay: false,
  depthFileName: "",
  depthInferenceMessage: "",
  depthImageDataUrl: "",
  patternFileName: "",
  patternImageDataUrl: "",
};

function createDefaultExportName(date = new Date()) {
  const parts = [
    date.getDate(),
    date.getMonth() + 1,
    date.getFullYear(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ].map((part) => String(part).padStart(2, "0"));

  return `magiceye_${parts[0]}-${parts[1]}-${parts[2]}_${parts[3]}-${parts[4]}-${parts[5]}.png`;
}

function normalisePngFileName(fileName: string) {
  const trimmedName = fileName.trim() || createDefaultExportName();
  return trimmedName.toLowerCase().endsWith(".png")
    ? trimmedName
    : `${trimmedName}.png`;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function readStoredGeneratorState(): StoredGeneratorState {
  try {
    const storedValue = window.localStorage.getItem(storageKeys.generator);

    if (!storedValue) {
      return defaultStoredGeneratorState;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredGeneratorState>;

    return {
      version: 1,
      exportName:
        typeof parsedValue.exportName === "string" ? parsedValue.exportName : "",
      depthStrength: clampNumber(
        parsedValue.depthStrength,
        0,
        100,
        defaultStoredGeneratorState.depthStrength,
      ),
      repeatWidth: clampNumber(
        parsedValue.repeatWidth,
        48,
        240,
        defaultStoredGeneratorState.repeatWidth,
      ),
      animationEnabled: parsedValue.animationEnabled === true,
      animationSpeed: clampNumber(
        parsedValue.animationSpeed,
        4,
        120,
        defaultStoredGeneratorState.animationSpeed,
      ),
      showDepthOverlay: parsedValue.showDepthOverlay === true,
      depthFileName:
        typeof parsedValue.depthFileName === "string" ? parsedValue.depthFileName : "",
      depthInferenceMessage:
        typeof parsedValue.depthInferenceMessage === "string"
          ? parsedValue.depthInferenceMessage
          : "",
      depthImageDataUrl:
        typeof parsedValue.depthImageDataUrl === "string"
          ? parsedValue.depthImageDataUrl
          : "",
      patternFileName:
        typeof parsedValue.patternFileName === "string"
          ? parsedValue.patternFileName
          : "",
      patternImageDataUrl:
        typeof parsedValue.patternImageDataUrl === "string"
          ? parsedValue.patternImageDataUrl
          : "",
    };
  } catch {
    return defaultStoredGeneratorState;
  }
}

function writeStoredGeneratorState(payload: StoredGeneratorState) {
  try {
    window.localStorage.setItem(storageKeys.generator, JSON.stringify(payload));
  } catch {
    const controlsOnlyPayload: StoredGeneratorState = {
      ...payload,
      depthFileName: "",
      depthInferenceMessage: "",
      depthImageDataUrl: "",
      patternFileName: "",
      patternImageDataUrl: "",
    };

    try {
      window.localStorage.setItem(
        storageKeys.generator,
        JSON.stringify(controlsOnlyPayload),
      );
    } catch {
      window.localStorage.removeItem(storageKeys.generator);
    }
  }
}

function getImageValidationError(file: File) {
  return (supportedImageTypes as readonly string[]).includes(file.type)
    ? ""
    : "Choose a PNG, JPEG, or WEBP image.";
}

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes("Files");
}

function hasSupportedDraggedFile(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items).filter(
    (item) => item.kind === "file",
  );

  return items.some((item) =>
    (supportedImageTypes as readonly string[]).includes(item.type),
  );
}

function getPreviewSize(image: HTMLImageElement, bounds: PreviewBounds) {
  const fallbackWidth = Math.min(maxPreviewEdge, image.naturalWidth);
  const fallbackHeight = Math.max(
    1,
    Math.round(fallbackWidth / (image.naturalWidth / image.naturalHeight)),
  );
  const imageAspectRatio = image.naturalWidth / image.naturalHeight;
  const boundsWidth = bounds.width > 0 ? bounds.width : fallbackWidth;
  const boundsHeight = bounds.height > 0 ? bounds.height : fallbackHeight;
  const boundsAspectRatio = boundsWidth / boundsHeight;
  const targetWidth = boundsAspectRatio > imageAspectRatio
    ? boundsHeight * imageAspectRatio
    : boundsWidth;
  const targetHeight = boundsAspectRatio > imageAspectRatio
    ? boundsHeight
    : boundsWidth / imageAspectRatio;
  const edgeScale = Math.min(1, maxPreviewEdge / Math.max(targetWidth, targetHeight));
  const pixelScale = Math.min(1, Math.sqrt(maxPreviewPixels / (targetWidth * targetHeight)));
  const scale = Math.min(edgeScale, pixelScale);
  const width = Math.max(1, Math.round(targetWidth * scale));
  const height = Math.max(1, Math.round(targetHeight * scale));

  return { width, height };
}

function loadImageSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not restore stored image."));
    image.src = source;
  });
}

function imageToStoredDataUrl(image: HTMLImageElement, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create storage image context.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

function revokeObjectUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function GeneratorPage() {
  const [storedGeneratorState] = useState(readStoredGeneratorState);
  const [exportName, setExportName] = useState(storedGeneratorState.exportName);
  const [depthStrength, setDepthStrength] = useState(
    storedGeneratorState.depthStrength,
  );
  const [repeatWidth, setRepeatWidth] = useState(storedGeneratorState.repeatWidth);
  const [animationEnabled, setAnimationEnabled] = useState(
    storedGeneratorState.animationEnabled,
  );
  const [animationSpeed, setAnimationSpeed] = useState(
    storedGeneratorState.animationSpeed,
  );
  const [showDepthOverlay, setShowDepthOverlay] = useState(
    storedGeneratorState.showDepthOverlay,
  );
  const [depthImage, setDepthImage] = useState<HTMLImageElement | null>(null);
  const [depthFileName, setDepthFileName] = useState(
    storedGeneratorState.depthImageDataUrl ? storedGeneratorState.depthFileName : "",
  );
  const [depthInferenceMessage, setDepthInferenceMessage] = useState(
    storedGeneratorState.depthImageDataUrl
      ? storedGeneratorState.depthInferenceMessage
      : "",
  );
  const [depthImportError, setDepthImportError] = useState("");
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null);
  const [patternFileName, setPatternFileName] = useState(
    storedGeneratorState.patternImageDataUrl
      ? storedGeneratorState.patternFileName
      : "",
  );
  const [patternImportError, setPatternImportError] = useState("");
  const [dragSource, setDragSource] = useState<ImportSource | null>(null);
  const [rejectedDragSource, setRejectedDragSource] = useState<ImportSource | null>(null);
  const [depthThumbnailUrl, setDepthThumbnailUrl] = useState(
    storedGeneratorState.depthImageDataUrl,
  );
  const [patternThumbnailUrl, setPatternThumbnailUrl] = useState(
    storedGeneratorState.patternImageDataUrl,
  );
  const [depthImageDataUrl, setDepthImageDataUrl] = useState(
    storedGeneratorState.depthImageDataUrl,
  );
  const [patternImageDataUrl, setPatternImageDataUrl] = useState(
    storedGeneratorState.patternImageDataUrl,
  );
  const [previewBounds, setPreviewBounds] = useState<PreviewBounds>({
    width: 0,
    height: 0,
  });
  const depthThumbnailUrlRef = useRef("");
  const patternThumbnailUrlRef = useRef("");
  const depthImportRequestRef = useRef(0);
  const patternImportRequestRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imageAccept = supportedImageTypes.join(",");

  useEffect(() => {
    return () => {
      if (depthThumbnailUrlRef.current) {
        revokeObjectUrl(depthThumbnailUrlRef.current);
      }

      if (patternThumbnailUrlRef.current) {
        revokeObjectUrl(patternThumbnailUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const previewElement = canvasRef.current?.parentElement ?? null;

    if (!previewElement) {
      return;
    }

    const observedElement = previewElement;

    function updatePreviewBounds() {
      const bounds = observedElement.getBoundingClientRect();
      setPreviewBounds({
        width: Math.max(1, Math.round(bounds.width)),
        height: Math.max(1, Math.round(bounds.height)),
      });
    }

    updatePreviewBounds();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePreviewBounds);

      return () => window.removeEventListener("resize", updatePreviewBounds);
    }

    const resizeObserver = new ResizeObserver(updatePreviewBounds);
    resizeObserver.observe(observedElement);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function restoreStoredImages() {
      if (storedGeneratorState.depthImageDataUrl) {
        try {
          const image = await loadImageSource(storedGeneratorState.depthImageDataUrl);

          if (isCurrent) {
            setDepthImage(image);
            setDepthImportError("");
          }
        } catch {
          if (isCurrent) {
            setDepthImageDataUrl("");
            setDepthThumbnailUrl("");
            setDepthFileName("");
            setDepthInferenceMessage("");
          }
        }
      }

      if (storedGeneratorState.patternImageDataUrl) {
        try {
          const image = await loadImageSource(storedGeneratorState.patternImageDataUrl);

          if (isCurrent) {
            setPatternImage(image);
            setPatternImportError("");
          }
        } catch {
          if (isCurrent) {
            setPatternImageDataUrl("");
            setPatternThumbnailUrl("");
            setPatternFileName("");
          }
        }
      }
    }

    void restoreStoredImages();

    return () => {
      isCurrent = false;
    };
  }, [storedGeneratorState.depthImageDataUrl, storedGeneratorState.patternImageDataUrl]);

  useEffect(() => {
    const payload: StoredGeneratorState = {
      version: 1,
      exportName,
      depthStrength,
      repeatWidth,
      animationEnabled,
      animationSpeed,
      showDepthOverlay,
      depthFileName: depthImageDataUrl ? depthFileName : "",
      depthInferenceMessage: depthImageDataUrl ? depthInferenceMessage : "",
      depthImageDataUrl,
      patternFileName: patternImageDataUrl ? patternFileName : "",
      patternImageDataUrl,
    };

    writeStoredGeneratorState(payload);
  }, [
    depthFileName,
    depthImageDataUrl,
    depthInferenceMessage,
    depthStrength,
    animationEnabled,
    animationSpeed,
    exportName,
    patternFileName,
    patternImageDataUrl,
    repeatWidth,
    showDepthOverlay,
  ]);

  function clearDepthImport() {
    setDepthImage(null);
    setDepthFileName("");
    setDepthInferenceMessage("");
    setDepthImageDataUrl("");
    replaceDepthThumbnail(null);
  }

  function clearPatternImport() {
    setPatternImage(null);
    setPatternFileName("");
    setPatternImageDataUrl("");
    replacePatternThumbnail(null);
  }

  function replaceDepthThumbnail(file: File | null) {
    if (depthThumbnailUrlRef.current) {
      revokeObjectUrl(depthThumbnailUrlRef.current);
    }

    const nextUrl = file ? URL.createObjectURL(file) : "";
    depthThumbnailUrlRef.current = nextUrl;
    setDepthThumbnailUrl(nextUrl);
  }

  function replacePatternThumbnail(file: File | null) {
    if (patternThumbnailUrlRef.current) {
      revokeObjectUrl(patternThumbnailUrlRef.current);
    }

    const nextUrl = file ? URL.createObjectURL(file) : "";
    patternThumbnailUrlRef.current = nextUrl;
    setPatternThumbnailUrl(nextUrl);
  }

  async function importPatternFile(file: File) {
    const requestId = patternImportRequestRef.current + 1;
    patternImportRequestRef.current = requestId;
    const validationError = getImageValidationError(file);

    if (validationError) {
      clearPatternImport();
      setPatternImportError(validationError);
      return;
    }

    try {
      const image = await loadImageFile(file);

      if (patternImportRequestRef.current !== requestId) {
        return;
      }

      setPatternImage(image);
      setPatternFileName(file.name);
      setPatternImageDataUrl(imageToStoredDataUrl(image, maxStoredPatternEdge));
      replacePatternThumbnail(file);
      setPatternImportError("");
    } catch (error) {
      if (patternImportRequestRef.current !== requestId) {
        return;
      }

      clearPatternImport();
      setPatternImportError(
        error instanceof Error ? error.message : "Could not load image.",
      );
    }
  }

  async function importDepthFile(file: File) {
    const requestId = depthImportRequestRef.current + 1;
    depthImportRequestRef.current = requestId;
    const validationError = getImageValidationError(file);

    if (validationError) {
      clearDepthImport();
      setDepthImportError(validationError);
      return;
    }

    try {
      const image = await loadImageFile(file);
      const inference = await inferDepthMap(image);

      if (depthImportRequestRef.current !== requestId) {
        return;
      }

      const storedDepthImageDataUrl = imageToStoredDataUrl(
        inference.image,
        maxStoredDepthEdge,
      );

      setDepthImage(inference.image);
      setDepthFileName(file.name);
      setDepthInferenceMessage(inference.message);
      setDepthImageDataUrl(storedDepthImageDataUrl);
      replaceDepthThumbnail(file);
      setDepthImportError("");
    } catch (error) {
      if (depthImportRequestRef.current !== requestId) {
        return;
      }

      clearDepthImport();
      setDepthImportError(
        error instanceof Error ? error.message : "Could not load image.",
      );
    }
  }

  async function handlePatternImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      await importPatternFile(file);
    }

    event.target.value = "";
  }

  async function handleDepthImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      await importDepthFile(file);
    }

    event.target.value = "";
  }

  function handleSourceDragOver(
    event: DragEvent<HTMLLabelElement>,
    source: ImportSource,
  ) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    const hasSupportedFile = hasSupportedDraggedFile(event.dataTransfer);
    event.dataTransfer.dropEffect = hasSupportedFile ? "copy" : "none";
    setDragSource(source);
    setRejectedDragSource(hasSupportedFile ? null : source);
  }

  function handleSourceDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setDragSource(null);
    setRejectedDragSource(null);
  }

  async function handleSourceDrop(
    event: DragEvent<HTMLLabelElement>,
    source: ImportSource,
  ) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setDragSource(null);
    setRejectedDragSource(null);

    const file = event.dataTransfer.files[0];

    if (!file) {
      return;
    }

    if (source === "depth") {
      await importDepthFile(file);
    } else {
      await importPatternFile(file);
    }
  }

  function handleExport() {
    const canvas = canvasRef.current;

    if (!canvas || !depthImage || !patternImage) {
      return;
    }

    const link = document.createElement("a");
    link.download = normalisePngFileName(exportName);
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !depthImage || !patternImage) {
      return;
    }

    let animationFrameId = 0;
    let animationStartedAt = 0;
    let previousAnimatedFrameAt = 0;
    const animatedFrameInterval = 1000 / 12;

    function renderFrame(patternOffset = 0) {
      if (!canvas || !depthImage || !patternImage) {
        return;
      }

      const { width, height } = getPreviewSize(depthImage, previewBounds);

      renderStereogram({
        canvas,
        depthImage,
        patternImage,
        patternOffsetX: patternOffset,
        patternOffsetY: patternOffset * 0.35,
        settings: {
          ...defaultStereogramSettings,
          width,
          height,
          depthStrength,
          repeatWidth,
        },
        showDepthOverlay,
      });
    }

    function renderAnimatedFrame(timestamp: number) {
      if (!animationStartedAt) {
        animationStartedAt = timestamp;
      }

      if (timestamp - previousAnimatedFrameAt >= animatedFrameInterval) {
        const elapsedSeconds = (timestamp - animationStartedAt) / 1000;
        renderFrame(elapsedSeconds * animationSpeed);
        previousAnimatedFrameAt = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(renderAnimatedFrame);
    }

    const timeoutId = window.setTimeout(() => {
      animationFrameId = window.requestAnimationFrame((timestamp) => {
        if (animationEnabled) {
          renderAnimatedFrame(timestamp);
          return;
        }

        renderFrame();
      });
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    animationEnabled,
    animationSpeed,
    depthImage,
    depthStrength,
    patternImage,
    previewBounds,
    repeatWidth,
    showDepthOverlay,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || (depthImage && patternImage)) {
      return;
    }

    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [depthImage, patternImage]);

  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="Stereogram Generator"
        title="Generate hidden-depth images"
        description="Import a depth map and pattern tile, tune the render settings, then export the stereogram."
      />

      <div className={styles.workspaceGrid}>
        <aside className={styles.toolPanel} aria-label="Generator controls">
          <FieldGroup title="Sources">
            <div className={styles.sourceDropStack}>
              <div className={styles.sourceDropItem}>
                <label
                  className={classNames(styles.dropZone, {
                    [styles.dragActive]: dragSource === "depth",
                    [styles.dragRejected]: rejectedDragSource === "depth",
                  })}
                  onDragOver={(event) => handleSourceDragOver(event, "depth")}
                  onDragLeave={handleSourceDragLeave}
                  onDrop={(event) => void handleSourceDrop(event, "depth")}
                >
                  {depthThumbnailUrl ? (
                    <img
                      className={styles.dropThumbnail}
                      src={depthThumbnailUrl}
                      alt=""
                      aria-hidden="true"
                    />
                  ) : (
                    <MdiIcon path={mdiLayersPlus} />
                  )}
                  <span>
                    <strong>Import depth map</strong>
                    <small>Drop a depth image here, or choose a file</small>
                  </span>
                  <input
                    type="file"
                    accept={imageAccept}
                    onChange={handleDepthImport}
                  />
                </label>
                {depthFileName ? <p className={styles.sourceFile}>{depthFileName}</p> : null}
                {depthInferenceMessage ? (
                  <p className={styles.sourceNote}>{depthInferenceMessage}</p>
                ) : null}
                {depthImportError ? (
                  <p className={styles.formError}>{depthImportError}</p>
                ) : null}
              </div>

              <div className={styles.sourceDropItem}>
                <label
                  className={classNames(styles.dropZone, {
                    [styles.dragActive]: dragSource === "pattern",
                    [styles.dragRejected]: rejectedDragSource === "pattern",
                  })}
                  onDragOver={(event) => handleSourceDragOver(event, "pattern")}
                  onDragLeave={handleSourceDragLeave}
                  onDrop={(event) => void handleSourceDrop(event, "pattern")}
                >
                  {patternThumbnailUrl ? (
                    <img
                      className={styles.dropThumbnail}
                      src={patternThumbnailUrl}
                      alt=""
                      aria-hidden="true"
                    />
                  ) : (
                    <MdiIcon path={mdiTextureBox} />
                  )}
                  <span>
                    <strong>Import pattern</strong>
                    <small>Drop a pattern tile here, or choose a file</small>
                  </span>
                  <input
                    type="file"
                    accept={imageAccept}
                    onChange={handlePatternImport}
                  />
                </label>
                {patternFileName ? (
                  <p className={styles.sourceFile}>{patternFileName}</p>
                ) : null}
                {patternImportError ? (
                  <p className={styles.formError}>{patternImportError}</p>
                ) : null}
              </div>
            </div>
          </FieldGroup>

          <FieldGroup title="Render">
            <RangeField
              label="Depth strength"
              min={0}
              max={100}
              value={depthStrength}
              valueLabel={`${depthStrength}%`}
              onChange={setDepthStrength}
            />
            <RangeField
              label="Repeat width"
              min={48}
              max={240}
              value={repeatWidth}
              valueLabel={`${repeatWidth}px`}
              onChange={setRepeatWidth}
            />
            <ToggleField
              checked={animationEnabled}
              iconPath={mdiMovieOpenPlayOutline}
              label="Animate preview"
              onChange={setAnimationEnabled}
            />
            {animationEnabled ? (
              <RangeField
                label="Animation speed"
                min={4}
                max={120}
                value={animationSpeed}
                valueLabel={`${animationSpeed}px/s`}
                onChange={setAnimationSpeed}
              />
            ) : null}
            <ToggleField
              checked={showDepthOverlay}
              iconPath={mdiLayersTripleOutline}
              label="Show depth overlay"
              onChange={setShowDepthOverlay}
            />
          </FieldGroup>

          <label className={styles.textField}>
            <span>Export name</span>
            <input
              type="text"
              value={exportName}
              placeholder={exportNamePlaceholder}
              onChange={(event) => setExportName(event.target.value)}
            />
          </label>

          <button
            className={styles.primaryAction}
            type="button"
            disabled={!depthImage || !patternImage}
            onClick={handleExport}
          >
            <MdiIcon path={mdiDownload} />
            Export PNG
          </button>
        </aside>

        <section
          className={classNames(styles.previewArea, styles.stereogramPreview)}
          aria-label="Stereogram preview"
        >
          <canvas ref={canvasRef} className={styles.stereogramCanvas} />
          {!depthImage || !patternImage ? (
            <div className={styles.previewEmpty}>
              <span>Import a depth map and pattern to generate a preview</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
