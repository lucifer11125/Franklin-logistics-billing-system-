import React from 'react';

interface AreaChartProps {
  data: { label: string; value: number }[];
}

export const AreaChart: React.FC<AreaChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 28, color: 'var(--text-muted)' }}>show_chart</span>
        <p style={{ fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>No Data Available</p>
      </div>
    );
  }

  const width = 500;
  const height = 180;
  const padX = 20, padY = 30;
  const maxVal = Math.max(...data.map(d => d.value), 1000);
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const pts = data.map((d, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * chartW,
    y: height - padY - (d.value / maxVal) * chartH,
    label: d.label,
    val: d.value,
  }));

  let dLine = '';
  if (pts.length > 0) {
    dLine = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const c = pts[i], n = pts[i + 1];
      const cpX1 = c.x + (n.x - c.x) / 3, cpY1 = c.y;
      const cpX2 = c.x + 2 * (n.x - c.x) / 3, cpY2 = n.y;
      dLine += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${n.x} ${n.y}`;
    }
  }

  const dArea = pts.length > 0
    ? `${dLine} L ${pts[pts.length-1].x} ${height-padY} L ${pts[0].x} ${height-padY} Z`
    : '';

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="gold-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
            <stop offset="80%" stopColor="#f59e0b" stopOpacity="0.01" />
          </linearGradient>
          <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct}
            x1={padX} x2={width - padX}
            y1={padY + (1 - pct) * chartH}
            y2={padY + (1 - pct) * chartH}
            stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4"
          />
        ))}
        <line x1={padX} x2={width-padX} y1={height-padY} y2={height-padY} stroke="rgba(245,158,11,0.15)" />

        {/* Area fill */}
        {dArea && <path d={dArea} fill="url(#gold-area-grad)" />}

        {/* Line */}
        {dLine && <path d={dLine} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#gold-glow)" />}

        {/* Data points + labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill="var(--navy-1)" stroke="#f59e0b" strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r={2} fill="#f59e0b" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#f0f2ff" fontSize={9} fontWeight="700" fontFamily="Space Grotesk">
              ₹{p.val >= 1000 ? `${(p.val / 1000).toFixed(1)}K` : p.val.toFixed(0)}
            </text>
            <text x={p.x} y={height - 10} textAnchor="middle" fill="#4a5080" fontSize={8} fontWeight="700" fontFamily="Space Grotesk">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default AreaChart;
