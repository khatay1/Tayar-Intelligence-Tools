export interface BuilderDropIndicatorProps {
  x: number;
  y: number;
  width: number;
  visible: boolean;
  label?: string;
}

export function BuilderDropIndicator({ x, y, width, visible, label }: BuilderDropIndicatorProps) {
  if (!visible) return null;
  return (
    <div className="tayar-v2-drop-indicator" style={{ left: x, top: y, width }} aria-hidden="true">
      {label ? <span>{label}</span> : null}
    </div>
  );
}
