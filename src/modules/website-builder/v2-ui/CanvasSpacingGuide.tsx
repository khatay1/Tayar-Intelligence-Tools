import type { CanvasSpacingGuide as CanvasSpacingGuideModel } from '../core/editor-canvas-geometry';

export interface CanvasSpacingGuideProps {
  guide?: CanvasSpacingGuideModel;
}

export function CanvasSpacingGuide({ guide }: CanvasSpacingGuideProps) {
  if (!guide) return null;

  const horizontal = guide.axis === 'x';
  const firstStart = Math.min(guide.beforeStart, guide.beforeEnd);
  const firstSize = Math.max(1, Math.abs(guide.beforeEnd - guide.beforeStart));
  const secondStart = Math.min(guide.afterStart, guide.afterEnd);
  const secondSize = Math.max(1, Math.abs(guide.afterEnd - guide.afterStart));
  const commonLine: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 36,
    background: '#a855f7',
    boxShadow: '0 0 0 1px rgba(168,85,247,.18)',
  };

  return (
    <div className="tayar-v2-spacing-guide" aria-hidden="true">
      <span
        style={horizontal
          ? { ...commonLine, left: firstStart, top: '50%', width: firstSize, height: 1 }
          : { ...commonLine, top: firstStart, left: '50%', height: firstSize, width: 1 }}
      />
      <span
        style={horizontal
          ? { ...commonLine, left: secondStart, top: '50%', width: secondSize, height: 1 }
          : { ...commonLine, top: secondStart, left: '50%', height: secondSize, width: 1 }}
      />
      <strong
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 37,
          left: horizontal ? (firstStart + firstSize / 2) : '50%',
          top: horizontal ? '50%' : (firstStart + firstSize / 2),
          transform: 'translate(-50%, -50%)',
          padding: '2px 5px',
          borderRadius: 4,
          background: '#7e22ce',
          color: '#fff',
          fontSize: 9,
          fontWeight: 800,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,.28)',
        }}
      >
        {guide.gap}px
      </strong>
    </div>
  );
}
