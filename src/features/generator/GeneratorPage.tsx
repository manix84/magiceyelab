import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import { mdiDownload, mdiLayersPlus, mdiTextureBox } from "@mdi/js";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";
import { supportedImageTypes } from "../import-export";
import { inferDepthMap } from "../../lib/image/inferDepthMap";
import { loadImageFile } from "../../lib/image/loadImageFile";
import { defaultStereogramSettings } from "../../lib/stereogram/settings";
import { renderStereogram } from "../../lib/stereogram/renderStereogram";
import styles from "./GeneratorPage.module.scss";

const maxPreviewWidth = 1200;
type ImportSource = "depth" | "pattern";

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

function getPreviewSize(image: HTMLImageElement) {
  const width = Math.min(maxPreviewWidth, image.naturalWidth);
  const height = Math.max(1, Math.round(width / (image.naturalWidth / image.naturalHeight)));

  return { width, height };
}

export function GeneratorPage() {
  const [defaultExportName] = useState(createDefaultExportName);
  const [exportName, setExportName] = useState("");
  const [depthStrength, setDepthStrength] = useState(45);
  const [repeatWidth, setRepeatWidth] = useState(120);
  const [showDepthOverlay, setShowDepthOverlay] = useState(false);
  const [depthImage, setDepthImage] = useState<HTMLImageElement | null>(null);
  const [depthFileName, setDepthFileName] = useState("");
  const [depthInferenceMessage, setDepthInferenceMessage] = useState("");
  const [depthImportError, setDepthImportError] = useState("");
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null);
  const [patternFileName, setPatternFileName] = useState("");
  const [patternImportError, setPatternImportError] = useState("");
  const [dragSource, setDragSource] = useState<ImportSource | null>(null);
  const [rejectedDragSource, setRejectedDragSource] = useState<ImportSource | null>(null);
  const [depthThumbnailUrl, setDepthThumbnailUrl] = useState("");
  const [patternThumbnailUrl, setPatternThumbnailUrl] = useState("");
  const depthThumbnailUrlRef = useRef("");
  const patternThumbnailUrlRef = useRef("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imageAccept = supportedImageTypes.join(",");

  useEffect(() => {
    return () => {
      if (depthThumbnailUrlRef.current) {
        URL.revokeObjectURL(depthThumbnailUrlRef.current);
      }

      if (patternThumbnailUrlRef.current) {
        URL.revokeObjectURL(patternThumbnailUrlRef.current);
      }
    };
  }, []);

  function clearDepthImport() {
    setDepthImage(null);
    setDepthFileName("");
    setDepthInferenceMessage("");
    replaceDepthThumbnail(null);
  }

  function clearPatternImport() {
    setPatternImage(null);
    setPatternFileName("");
    replacePatternThumbnail(null);
  }

  function replaceDepthThumbnail(file: File | null) {
    if (depthThumbnailUrlRef.current) {
      URL.revokeObjectURL(depthThumbnailUrlRef.current);
    }

    const nextUrl = file ? URL.createObjectURL(file) : "";
    depthThumbnailUrlRef.current = nextUrl;
    setDepthThumbnailUrl(nextUrl);
  }

  function replacePatternThumbnail(file: File | null) {
    if (patternThumbnailUrlRef.current) {
      URL.revokeObjectURL(patternThumbnailUrlRef.current);
    }

    const nextUrl = file ? URL.createObjectURL(file) : "";
    patternThumbnailUrlRef.current = nextUrl;
    setPatternThumbnailUrl(nextUrl);
  }

  async function importPatternFile(file: File) {
    const validationError = getImageValidationError(file);

    if (validationError) {
      clearPatternImport();
      setPatternImportError(validationError);
      return;
    }

    try {
      const image = await loadImageFile(file);
      setPatternImage(image);
      setPatternFileName(file.name);
      replacePatternThumbnail(file);
      setPatternImportError("");
    } catch (error) {
      clearPatternImport();
      setPatternImportError(
        error instanceof Error ? error.message : "Could not load image.",
      );
    }
  }

  async function importDepthFile(file: File) {
    const validationError = getImageValidationError(file);

    if (validationError) {
      clearDepthImport();
      setDepthImportError(validationError);
      return;
    }

    try {
      const image = await loadImageFile(file);
      const inference = await inferDepthMap(image);
      setDepthImage(inference.image);
      setDepthFileName(file.name);
      setDepthInferenceMessage(inference.message);
      replaceDepthThumbnail(file);
      setDepthImportError("");
    } catch (error) {
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
    link.download = normalisePngFileName(exportName || defaultExportName);
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !depthImage || !patternImage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const frameId = window.requestAnimationFrame(() => {
        const { width, height } = getPreviewSize(depthImage);

        renderStereogram({
          canvas,
          depthImage,
          patternImage,
          settings: {
            ...defaultStereogramSettings,
            width,
            height,
            depthStrength,
            repeatWidth,
          },
          showDepthOverlay,
        });
      });

      canvas.dataset.renderFrame = String(frameId);
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);

      if (canvas.dataset.renderFrame) {
        window.cancelAnimationFrame(Number(canvas.dataset.renderFrame));
        delete canvas.dataset.renderFrame;
      }
    };
  }, [depthImage, depthStrength, patternImage, repeatWidth, showDepthOverlay]);

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
            <label className={styles.rangeField}>
              <span className={styles.rangeLabel}>
                <span>Depth strength</span>
                <output>{depthStrength}%</output>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={depthStrength}
                onChange={(event) => setDepthStrength(Number(event.target.value))}
              />
            </label>
            <label className={styles.rangeField}>
              <span className={styles.rangeLabel}>
                <span>Repeat width</span>
                <output>{repeatWidth}px</output>
              </span>
              <input
                type="range"
                min="48"
                max="240"
                value={repeatWidth}
                onChange={(event) => setRepeatWidth(Number(event.target.value))}
              />
            </label>
            <label className={styles.toggleField}>
              <input
                type="checkbox"
                checked={showDepthOverlay}
                onChange={(event) => setShowDepthOverlay(event.target.checked)}
              />
              <span className={styles.toggleSwitch} aria-hidden="true" />
              <span className={styles.toggleLabel}>Show depth overlay</span>
            </label>
          </FieldGroup>

          <label className={styles.textField}>
            <span>Export name</span>
            <input
              type="text"
              value={exportName}
              placeholder={defaultExportName}
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
