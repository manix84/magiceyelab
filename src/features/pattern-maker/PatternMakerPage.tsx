import { mdiBrush, mdiDiceMultiple, mdiEraser, mdiPalette } from "@mdi/js";
import { CanvasPlaceholder } from "../../components/canvas/CanvasPlaceholder";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";

const palette = ["#1d3557", "#e63946", "#f1faee", "#2a9d8f", "#f4a261"];

export function PatternMakerPage() {
  return (
    <div className="workspace">
      <PageHeader
        eyebrow="Pattern Maker"
        title="Build seamless repeating tiles"
        description="Draw a compact pattern tile, preview its repeat, and feed it into the stereogram generator."
      />

      <div className="workspace-grid">
        <aside className="tool-panel" aria-label="Pattern maker controls">
          <FieldGroup title="Tools">
            <div className="segmented-control" aria-label="Pattern tool">
              <button type="button" aria-pressed="true">
                <MdiIcon path={mdiBrush} />
                Brush
              </button>
              <button type="button" aria-pressed="false">
                <MdiIcon path={mdiEraser} />
                Eraser
              </button>
            </div>
          </FieldGroup>

          <FieldGroup title="Palette">
            <div className="palette-row">
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select ${color}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button type="button">
              <MdiIcon path={mdiPalette} />
              Edit palette
            </button>
          </FieldGroup>

          <button className="primary-action" type="button">
            <MdiIcon path={mdiDiceMultiple} />
            Random pattern
          </button>
        </aside>

        <section className="preview-area split-preview" aria-label="Pattern canvases">
          <CanvasPlaceholder label="Pattern tile" />
          <CanvasPlaceholder label="Seamless preview" tone="dark" />
        </section>
      </div>
    </div>
  );
}
