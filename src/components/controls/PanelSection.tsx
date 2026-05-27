import type { ReactNode } from "react";
import styles from "./PanelSection.module.scss";

type PanelSectionProps = {
  children: ReactNode;
  title?: ReactNode;
};

export function PanelSection({ children, title }: PanelSectionProps) {
  return (
    <div className={styles.section}>
      {title ? <span className={styles.title}>{title}</span> : null}
      {children}
    </div>
  );
}
