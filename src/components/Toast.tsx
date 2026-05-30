import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  messages: ToastMessage[];
  onRemove: (id: string) => void;
}

const TOAST_CONFIG = {
  success: { icon: 'check_circle', color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
  error:   { icon: 'error',        color: '#fb7185', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.2)'   },
  info:    { icon: 'info',         color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)'  },
};

const ToastItem: React.FC<{ message: ToastMessage; onRemove: (id: string) => void }> = ({ message, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(message.id), 4200);
    return () => clearTimeout(timer);
  }, [message.id, onRemove]);

  const cfg = TOAST_CONFIG[message.type];
  return (
    <div
      className="anim-slide-up"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 14,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        maxWidth: 360,
        width: '100%',
        cursor: 'pointer',
      }}
      onClick={() => onRemove(message.id)}
    >
      <span
        className="material-symbols-rounded shrink-0"
        style={{ fontSize: 18, color: cfg.color, fontVariationSettings: "'FILL' 1" }}
      >
        {cfg.icon}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Space Grotesk', flex: 1, lineHeight: 1.4 }}>
        {message.text}
      </span>
      <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>close</span>
    </div>
  );
};

const Toast: React.FC<ToastProps> = ({ messages, onRemove }) => {
  if (messages.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 88,
        right: 24,
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'flex-end',
      }}
    >
      {messages.map(m => (
        <ToastItem key={m.id} message={m} onRemove={onRemove} />
      ))}
    </div>
  );
};

export default Toast;
