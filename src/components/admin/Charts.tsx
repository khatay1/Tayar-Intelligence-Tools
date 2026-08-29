import { useLocalizer } from '@/lib/ui-localization';
import { useMemo } from 'react';

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

export function LineChart({ data, color = '#a78bfa', height = 200, formatValue }: LineChartProps) {
  const l = useLocalizer();
  const { points, areaPath, linePath } = useMemo(() => {
    if (data.length === 0) return { points: [], areaPath: '', linePath: '', maxVal: 0, minVal: 0 };
    const w = 100;
    const h = 100;
    const padding = 5;
    const max = Math.max(...data.map(d => d.value), 1);
    const min = Math.min(...data.map(d => d.value), 0);
    const range = max - min || 1;
    const stepX = (w - padding * 2) / Math.max(data.length - 1, 1);
    const pts = data.map((d, i) => ({
      x: padding + i * stepX,
      y: h - padding - ((d.value - min) / range) * (h - padding * 2),
      ...d,
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${line} L ${pts[pts.length - 1].x} ${h - padding} L ${pts[0].x} ${h - padding} Z`;
    return { points: pts, areaPath: area, linePath: line, maxVal: max, minVal: min };
  }, [data]);

  if (data.length === 0) {
    return <div className="flex items-center justify-center text-gray-600 text-sm" style={{ height }}>{l('No data')}</div>;
  }

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.2" fill={color} className="opacity-0 hover:opacity-100 transition-opacity">
            <title>{formatValue ? formatValue(p.value) : p.value}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-gray-500">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

interface BarChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({ data, color = '#a78bfa', height = 200, formatValue }: BarChartProps) {
  const l = useLocalizer();
  const max = Math.max(...data.map(d => d.value), 1);
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-gray-600 text-sm" style={{ height }}>{l('No data')}</div>;
  }
  return (
    <div className="w-full flex flex-col gap-2" style={{ height }}>
      <div className="flex-1 flex items-end justify-around gap-1.5 min-h-0">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
            <div className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
              {formatValue ? formatValue(d.value) : d.value}
            </div>
            <div
              className="w-full rounded-t-md transition-all duration-500 hover:opacity-80 relative overflow-hidden"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: `linear-gradient(to top, ${color}40, ${color})`,
                minHeight: d.value > 0 ? '4px' : '0',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-around gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-gray-500 truncate">{d.label}</div>
        ))}
      </div>
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color?: string }[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: DonutChartProps) {
  const l = useLocalizer();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ['#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee'];

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-sm" style={{ width: size, height: size }}>
        {l('No data')}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e1e3a" strokeWidth="10" />
        {data.map((d, i) => {
          const fraction = d.value / total;
          const dash = fraction * circumference;
          const seg = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={d.color || colors[i % colors.length]}
              strokeWidth="10"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ background: d.color || colors[i % colors.length] }} />
            <span className="text-gray-300">{d.label}</span>
            <span className="text-gray-500 ml-auto pl-2">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color = '#a78bfa', width = 80, height = 24 }: SparklineProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
