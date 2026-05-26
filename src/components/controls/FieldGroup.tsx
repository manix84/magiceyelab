import type { ReactNode } from "react";
import styles from "./FieldGroup.module.scss";

type FieldGroupProps = {
  title: string;
  children: ReactNode;
};

export function FieldGroup({ title, children }: FieldGroupProps) {
  return (
    <section className={styles.group} aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`}>{title}</h2>
      {children}
    </section>
  );
}
