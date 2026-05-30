import React from 'react';

const ShimmerBlock: React.FC<{ h?: number; w?: string; radius?: number }> = ({ h = 20, w = '100%', radius = 10 }) => (
  <div className="cs-shimmer" style={{ height: h, width: w, borderRadius: radius }} />
);

const LoadingShimmer: React.FC = () => (
  <div className="anim-fade-in w-full" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    {/* Header shimmer */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="cs-shimmer" style={{ width: 36, height: 36, borderRadius: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <ShimmerBlock h={10} w="30%" />
        <ShimmerBlock h={16} w="55%" />
      </div>
    </div>

    {/* Stats grid */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: 'var(--navy-1)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ShimmerBlock h={8} w="40%" />
          <ShimmerBlock h={32} w="60%" />
          <ShimmerBlock h={8} w="50%" />
        </div>
      ))}
    </div>

    {/* Main scan zone shimmer */}
    <div className="cs-shimmer" style={{ height: 300, borderRadius: 20 }} />

    {/* Bottom card */}
    <div style={{ background: 'var(--navy-1)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ShimmerBlock h={10} w="25%" />
      <ShimmerBlock h={14} w="60%" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <ShimmerBlock h={10} w="90%" />
        <ShimmerBlock h={10} w="75%" />
        <ShimmerBlock h={10} w="82%" />
      </div>
    </div>

    {/* Gold scanning badge */}
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
        background: 'rgba(245,158,11,0.06)', border: '1px solid var(--gold-border)', borderRadius: 999,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 10px rgba(245,158,11,0.6)', animation: 'pulse-amber 1.2s infinite' }} />
        <span style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          AI Analyzing Document...
        </span>
      </div>
    </div>
  </div>
);

export default LoadingShimmer;
