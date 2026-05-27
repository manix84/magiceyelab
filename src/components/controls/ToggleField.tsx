import type { ReactNode } from "react";
import { MdiIcon } from "../icons/MdiIcon";
import styles from "./ToggleField.module.scss";

type ToggleFieldProps = {
  checked: boolean;
  iconPath?: string;
  label: ReactNode;
  onChange: (checked: boolean) => void;
};

export function ToggleField({
  checked,
  iconPath,
  label,
  onChange,
}: ToggleFieldProps) {
  return (
    <label className={styles.field}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.switch} aria-hidden="true" />
      <span className={styles.label}>
        {iconPath ? <MdiIcon path={iconPath} /> : null}
        {label}
      </span>
    </label>
  );
}
