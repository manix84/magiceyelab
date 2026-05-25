import { Download, ImageUp, SlidersHorizontal } from "lucide-react";
import { CanvasPlaceholder } from "../../components/canvas/CanvasPlaceholder";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { PageHeader } from "../../components/layout/PageHeader";

export function GeneratorPage() {
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
              <ImageUp size={18} aria-hidden="true" />
              Import depth map
            </button>
            <button type="button">
              <ImageUp size={18} aria-hidden="true" />
              Import pattern
            </button>
          </FieldGroup>

          <FieldGroup title="Render">
            <label>
              Depth strength
              <input type="range" min="0" max="100" defaultValue="45" />
            </label>
            <label>
              Repeat width
              <input type="range" min="48" max="240" defaultValue="120" />
            </label>
            <button type="button">
              <SlidersHorizontal size={18} aria-hidden="true" />
              Preview render
            </button>
          </FieldGroup>

          <button className="primary-action" type="button">
            <Download size={18} aria-hidden="true" />
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
