import { mdiBrush, mdiEraser, mdiRedo, mdiTrashCanOutline, mdiUndo } from "@mdi/js";
import { CanvasPlaceholder } from "../../components/canvas/CanvasPlaceholder";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";

export function DepthPainterPage() {
  return (
    <div className="workspace">
      <PageHeader
        eyebrow="Depth Painter"
        title="Paint monochrome depth maps"
        description="White areas come forward, black areas recede, and mid-gray sits between them."
      />

      <div className="workspace-grid">
        <aside className="tool-panel" aria-label="Depth painter controls">
          <FieldGroup title="Tools">
            <div className="segmented-control" aria-label="Paint tool">
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

          <FieldGroup title="Brush">
            <label>
              Size
              <input type="range" min="1" max="96" defaultValue="24" />
            </label>
            <label>
              Depth value
              <input type="range" min="0" max="255" defaultValue="180" />
            </label>
          </FieldGroup>

          <div className="icon-row" aria-label="History controls">
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

        <section className="preview-area" aria-label="Depth map canvas">
          <CanvasPlaceholder label="Depth map canvas" />
        </section>
      </div>
    </div>
  );
}
