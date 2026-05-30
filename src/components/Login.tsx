import React, { useState, useRef, useEffect } from 'react';

interface LoginProps {
  onLogin: () => void;
}

// Credentials are stored as Vercel Environment Variables (VITE_AUTH_USERNAME / VITE_AUTH_PASSWORD)
// For local dev, add them to .env.local (which is gitignored)
const VALID_USERNAME = import.meta.env.VITE_AUTH_USERNAME as string;
const VALID_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD as string;

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate a brief auth delay for polish
    await new Promise(res => setTimeout(res, 700));

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem('flb_auth', 'true');
      onLogin();
    } else {
      setIsLoading(false);
      setError('Invalid credentials. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setPassword('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--navy-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Cosmic background */}
      <div className="star-field" />
      <div className="bg-cosmic-orb" />

      {/* Nebula accent */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80vw',
        height: '60vh',
        background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.07) 0%, rgba(59,91,219,0.05) 50%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div
        className="anim-scale-in"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'linear-gradient(160deg, rgba(17,19,48,0.98) 0%, rgba(13,14,36,0.99) 100%)',
          border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: 24,
          padding: '48px 40px 40px',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 60px rgba(245,158,11,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
          position: 'relative',
          animation: shake ? 'loginShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)' : undefined,
        }}
      >
        {/* Top gold shimmer line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)',
          borderRadius: 999,
        }} />

        {/* Logo + Branding */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(245,158,11,0.35), 0 0 0 8px rgba(245,158,11,0.06)',
          }}>
            <span
              className="material-symbols-rounded"
              style={{ fontSize: 30, color: '#08091a', fontVariationSettings: "'FILL' 1" }}
            >
              local_shipping
            </span>
          </div>

          <p className="text-label" style={{ color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: 6 }}>
            Frank Link Logistics
          </p>
          <h1 className="text-display" style={{ fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>
            Billing Intelligence
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', fontFamily: 'Space Grotesk' }}>
            Secure Access — Owner Only
          </p>
        </div>

        {/* Gold divider */}
        <div className="gold-line" style={{ marginBottom: 32 }} />

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Username */}
          <div>
            <label className="field-label" htmlFor="login-username">
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <span
                className="material-symbols-rounded"
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 18,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  fontVariationSettings: "'FILL' 0",
                }}
              >
                person
              </span>
              <input
                id="login-username"
                ref={usernameRef}
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="Enter your name"
                className="cs-input"
                style={{ paddingLeft: 44 }}
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="field-label" htmlFor="login-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span
                className="material-symbols-rounded"
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 18,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  fontVariationSettings: "'FILL' 0",
                }}
              >
                lock
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter password"
                className="cs-input"
                style={{ paddingLeft: 44, paddingRight: 48 }}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                  borderRadius: 6,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0" }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="anim-slide-up"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 10,
                marginTop: -4,
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#fb7185', fontVariationSettings: "'FILL' 1" }}>
                error
              </span>
              <span style={{ fontSize: 12, color: '#fb7185', fontFamily: 'Space Grotesk', fontWeight: 500 }}>
                {error}
              </span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="cs-btn-primary"
            id="login-submit-btn"
            disabled={isLoading}
            style={{
              width: '100%',
              marginTop: 4,
              height: 48,
              fontSize: 13,
              opacity: isLoading ? 0.75 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? (
              <>
                <span
                  className="material-symbols-rounded"
                  style={{
                    fontSize: 16,
                    animation: 'spin 1s linear infinite',
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  refresh
                </span>
                Authenticating…
              </>
            ) : (
              <>
                <span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                  login
                </span>
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: 28,
          fontSize: 10,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          fontFamily: 'Space Grotesk',
        }}>
          🔒 Private access — Frank Link Logistics
        </p>
      </div>

      <style>{`
        @keyframes loginShake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
