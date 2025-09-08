"use client";

export default function Sparkline({ data, width = 240, height = 48, strokeWidth = 2 }: { data: number[]; width?: number; height?: number; strokeWidth?: number }) {
  if (!data || data.length === 0) return <span className="text-xs text-gray-500">–</span>;
  const max = Math.max(...data, 1);
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const points = data.map((v, i) => {
    const x = pad + (i * innerW) / Math.max(1, data.length - 1);
    const y = pad + innerH - (v / max) * innerH;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline fill="none" stroke="#2563eb" strokeWidth={strokeWidth} points={points} />
    </svg>
  );
}



