import { useState } from "react";
import { mdiDownload, mdiImagePlus, mdiTuneVariant } from "@mdi/js";
import { CanvasPlaceholder } from "../../components/canvas/CanvasPlaceholder";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";

export function GeneratorPage() {
  const [depthStrength, setDepthStrength] = useState(45);
  const [repeatWidth, setRepeatWidth] = useState(120);

  return (
    <div className="workspace">
      <PageHeader
        eyebrow="Stereogram Generator"
        title="Generate hidden-depth images"
        description="Import a depth map and pattern tile, tune the render settings, then export the stereogram."
      />

      <div className="workspace-grid">
        <aside className="tool-panel" aria-label="Generator controls">
          <FieldGroup title="Sources">
            <button type="button">
              <MdiIcon path={mdiImagePlus} />
              Import depth map
            </button>
            <button type="button">
              <MdiIcon path={mdiImagePlus} />
              Import pattern
            </button>
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
            <button type="button">
              <MdiIcon path={mdiTuneVariant} />
              Preview render
            </button>
          </FieldGroup>

          <button className="primary-action" type="button">
            <MdiIcon path={mdiDownload} />
            Export PNG
          </button>
        </aside>

        <section className="preview-area" aria-label="Stereogram preview">
          <CanvasPlaceholder label="Stereogram canvas" tone="dark" />
        </section>
      </div>
    </div>
  );
}
