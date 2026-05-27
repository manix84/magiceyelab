import type { ReactNode } from "react";
import styles from "./RangeField.module.scss";

type RangeFieldProps = {
  ariaLabel?: string;
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
  valueLabel: ReactNode;
};

export function RangeField({
  ariaLabel,
  label,
  max,
  min,
  onChange,
  step,
  value,
  valueLabel,
}: RangeFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        <span>{label}</span>
        <output>{valueLabel}</output>
      </span>
      <input
        type="range"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
