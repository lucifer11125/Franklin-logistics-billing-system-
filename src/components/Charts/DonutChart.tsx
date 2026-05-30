import React from 'react';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
}

export const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div style={{ height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 28 }}>donut_small</span>
        <p style={{ fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>No Tax Data</p>
      </div>
    );
  }

  // Gold-themed color overrides
  const themeColors = ['#818cf8', '#38bdf8', '#f59e0b'];
  const themeData = data.map((item, idx) => ({ ...item, color: themeColors[idx % themeColors.length] }));

  const size = 160;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 28, width: '100%' }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />

          {/* Arc segments */}
          {themeData.map((item, idx) => {
            if (item.value === 0) return null;
            const pct = item.value / total;
            const dashArr = `${circumference * pct} ${circumference}`;
            const dashOff = -(accumulated * circumference);
            accumulated += pct;
            return (
              <circle
                key={idx}
                cx={center} cy={center} r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArr}
                strokeDashoffset={dashOff}
                strokeLinecap="butt"
                style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${item.color}55)` }}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <p style={{ fontFamily: 'Space Grotesk', fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tax Total</p>
          <p style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 14, color: 'var(--gold)', marginTop: 2 }}>
            ₹{total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {themeData.map((item, idx) => {
          if (item.value === 0) return null;
          const pct = ((item.value / total) * 100).toFixed(1);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, boxShadow: `0 0 8px ${item.color}66`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</p>
                <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: item.color, fontWeight: 700, marginTop: 1 }}>₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <p style={{ fontFamily: 'Space Mono', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DonutChart;
