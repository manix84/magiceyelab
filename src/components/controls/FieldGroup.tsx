import { useId, type ReactNode } from "react";
import styles from "./FieldGroup.module.scss";

type FieldGroupProps = {
  title: string;
  children: ReactNode;
};

export function FieldGroup({ title, children }: FieldGroupProps) {
  const headingId = useId();

  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}
