import classNames from "classnames";
import styles from "./CanvasPlaceholder.module.scss";

type CanvasPlaceholderProps = {
  label: string;
  tone?: "dark" | "light";
};

export function CanvasPlaceholder({
  label,
  tone = "light",
}: CanvasPlaceholderProps) {
  return (
    <div
      className={classNames(styles.placeholder, {
        [styles.dark]: tone === "dark",
      })}
    >
      <div className={styles.grid} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
