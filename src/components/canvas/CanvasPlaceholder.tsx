type CanvasPlaceholderProps = {
  label: string;
  tone?: "dark" | "light";
};

export function CanvasPlaceholder({
  label,
  tone = "light",
}: CanvasPlaceholderProps) {
  return (
    <div className={`canvas-placeholder canvas-placeholder-${tone}`}>
      <div className="canvas-grid" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
