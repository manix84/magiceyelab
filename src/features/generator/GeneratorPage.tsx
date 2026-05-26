import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { mdiDownload, mdiImagePlus } from "@mdi/js";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";
import { supportedImageTypes } from "../import-export";
import { inferDepthMap } from "../../lib/image/inferDepthMap";
import { loadImageFile } from "../../lib/image/loadImageFile";
import { defaultStereogramSettings } from "../../lib/stereogram/settings";
import { renderStereogram } from "../../lib/stereogram/renderStereogram";

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

export function GeneratorPage() {
  const [defaultExportName] = useState(createDefaultExportName);
  const [exportName, setExportName] = useState("");
  const [depthStrength, setDepthStrength] = useState(45);
  const [repeatWidth, setRepeatWidth] = useState(120);
  const [showDepthOverlay, setShowDepthOverlay] = useState(false);
  const [depthImage, setDepthImage] = useState<HTMLImageElement | null>(null);
  const [depthFileName, setDepthFileName] = useState("");
  const [depthInferenceMessage, setDepthInferenceMessage] = useState("");
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null);
  const [patternFileName, setPatternFileName] = useState("");
  const [importError, setImportError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imageAccept = supportedImageTypes.join(",");

  async function handleImageImport(
    event: ChangeEvent<HTMLInputElement>,
    onImageLoaded: (image: HTMLImageElement, fileName: string) => void,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!(supportedImageTypes as readonly string[]).includes(file.type)) {
      setImportError("Choose a PNG, JPEG, or WEBP image.");
      event.target.value = "";
      return;
    }

    try {
      const image = await loadImageFile(file);
      onImageLoaded(image, file.name);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not load image.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleDepthImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!(supportedImageTypes as readonly string[]).includes(file.type)) {
      setImportError("Choose a PNG, JPEG, or WEBP image.");
      event.target.value = "";
      return;
    }

    try {
      const image = await loadImageFile(file);
      const inference = await inferDepthMap(image);
      setDepthImage(inference.image);
      setDepthFileName(file.name);
      setDepthInferenceMessage(inference.message);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not load image.");
    } finally {
      event.target.value = "";
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

    renderStereogram({
      canvas,
      depthImage,
      patternImage,
      settings: {
        ...defaultStereogramSettings,
        width: depthImage.naturalWidth,
        height: depthImage.naturalHeight,
        depthStrength,
        repeatWidth,
      },
      showDepthOverlay,
    });
  }, [depthImage, depthStrength, patternImage, repeatWidth, showDepthOverlay]);

  return (
    <div className="workspace">
      <PageHeader
        eyebrow="Stereogram Generator"
        title="Generate hidden-depth images"
        description="Import a depth map and pattern tile, tune the render settings, then export the stereogram."
      />

      <div className="workspace-grid">
        <aside className="tool-panel" aria-label="Generator controls">
          <label className="text-field">
            <span>Export name</span>
            <input
              type="text"
              value={exportName}
              placeholder={defaultExportName}
              onChange={(event) => setExportName(event.target.value)}
            />
          </label>

          <FieldGroup title="Sources">
            <label className="file-button">
              <MdiIcon path={mdiImagePlus} />
              <span>Import depth map</span>
              <input
                type="file"
                accept={imageAccept}
                onChange={handleDepthImport}
              />
            </label>
            {depthFileName ? <p className="source-file">{depthFileName}</p> : null}
            {depthInferenceMessage ? (
              <p className="source-note">{depthInferenceMessage}</p>
            ) : null}

            <label className="file-button">
              <MdiIcon path={mdiImagePlus} />
              <span>Import pattern</span>
              <input
                type="file"
                accept={imageAccept}
                onChange={(event) =>
                  handleImageImport(event, (image, fileName) => {
                    setPatternImage(image);
                    setPatternFileName(fileName);
                  })
                }
              />
            </label>
            {patternFileName ? (
              <p className="source-file">{patternFileName}</p>
            ) : null}
            {importError ? <p className="form-error">{importError}</p> : null}
          </FieldGroup>

          <FieldGroup title="Render">
            <label className="range-field">
              <span className="range-label">
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
            <label className="range-field">
              <span className="range-label">
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
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={showDepthOverlay}
                onChange={(event) => setShowDepthOverlay(event.target.checked)}
              />
              <span>Show depth overlay</span>
            </label>
          </FieldGroup>

          <button
            className="primary-action"
            type="button"
            disabled={!depthImage || !patternImage}
            onClick={handleExport}
          >
            <MdiIcon path={mdiDownload} />
            Export PNG
          </button>
        </aside>

        <section className="preview-area stereogram-preview" aria-label="Stereogram preview">
          <canvas ref={canvasRef} className="stereogram-canvas" />
          {!depthImage || !patternImage ? (
            <div className="preview-empty">
              <span>Import a depth map and pattern to generate a preview</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
