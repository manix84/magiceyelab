import classNames from "classnames";
import { mdiBrush, mdiDiceMultiple, mdiEraser, mdiPalette } from "@mdi/js";
import { CanvasPlaceholder } from "../../components/canvas/CanvasPlaceholder";
import { FieldGroup } from "../../components/controls/FieldGroup";
import { MdiIcon } from "../../components/icons/MdiIcon";
import { PageHeader } from "../../components/layout/PageHeader";
import styles from "./PatternMakerPage.module.scss";

const palette = ["#1d3557", "#e63946", "#f1faee", "#2a9d8f", "#f4a261"];

export function PatternMakerPage() {
  return (
    <div className={styles.workspace}>
      <PageHeader
        eyebrow="Pattern Maker"
        title="Build seamless repeating tiles"
        description="Draw a compact pattern tile, preview its repeat, and feed it into the stereogram generator."
      />

      <div className={styles.workspaceGrid}>
        <aside className={styles.toolPanel} aria-label="Pattern maker controls">
          <FieldGroup title="Tools">
            <div className={styles.segmentedControl} aria-label="Pattern tool">
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
            <div className={styles.paletteRow}>
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

          <button className={styles.primaryAction} type="button">
            <MdiIcon path={mdiDiceMultiple} />
            Random pattern
          </button>
        </aside>

        <section
          className={classNames(styles.previewArea, styles.splitPreview)}
          aria-label="Pattern canvases"
        >
          <CanvasPlaceholder label="Pattern tile" />
          <CanvasPlaceholder label="Seamless preview" tone="dark" />
        </section>
      </div>
    </div>
  );
}
