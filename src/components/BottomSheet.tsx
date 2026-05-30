import React from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, onSelectCamera, onSelectGallery }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center anim-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="anim-slide-up"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--navy-2)',
          border: '1px solid var(--border-default)',
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: '28px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: '0 -20px 60px rgba(0,0,0,0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Pull handle */}
        <div
          style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 999, margin: '0 auto', cursor: 'pointer' }}
          onClick={onClose}
        />

        <div>
          <p className="text-label" style={{ color: 'var(--gold)', marginBottom: 4 }}>Capture Invoice</p>
          <h3 style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Select Document Source</h3>
        </div>

        <div className="gold-line" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Camera option */}
          <button
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 20px',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              background: 'rgba(245,158,11,0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.08)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
            }}
            onClick={() => { onSelectCamera(); onClose(); }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid var(--gold-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 22, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
            </div>
            <div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Smartphone Camera</p>
              <p style={{ fontFamily: 'Space Grotesk', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Capture a live photo of the physical invoice</p>
            </div>
          </button>

          {/* Gallery / PDF option */}
          <button
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 20px',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              background: 'rgba(59,91,219,0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(59,91,219,0.08)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,91,219,0.25)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(59,91,219,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
            }}
            onClick={() => { onSelectGallery(); onClose(); }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(59,91,219,0.12)',
              border: '1px solid rgba(59,91,219,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 22, color: '#818cf8', fontVariationSettings: "'FILL' 1" }}>upload_file</span>
            </div>
            <div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Upload PDF / Image</p>
              <p style={{ fontFamily: 'Space Grotesk', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Pick an existing photo or digital PDF invoice</p>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontFamily: 'Space Grotesk',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default BottomSheet;
