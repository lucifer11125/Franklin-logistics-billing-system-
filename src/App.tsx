import React, { useState, useEffect } from 'react';
import { useSettings } from './hooks/useSettings';
import Home from './pages/Home/Home';
import History from './pages/History/History';
import Summary from './pages/Summary/Summary';
import Settings from './pages/Settings/Settings';
import Toast, { ToastMessage } from './components/Toast';
import Login from './components/Login';

type Page = 'home' | 'history' | 'summary' | 'settings';

const NAV_ITEMS: { page: Page; icon: string; label: string }[] = [
  { page: 'home',     icon: 'home',      label: 'Dashboard' },
  { page: 'history',  icon: 'receipt_long', label: 'History' },
  { page: 'summary',  icon: 'bar_chart', label: 'Analytics' },
  { page: 'settings', icon: 'settings',  label: 'Settings'  },
];

export const App: React.FC = () => {
  const { settings, saveSettings } = useSettings();
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('flb_auth') === 'true');
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = () => {
    localStorage.removeItem('flb_auth');
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFade(true), 1200);
    const removeTimer = setTimeout(() => setShowSplash(false), 1700);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev, { id, text, type }]);
  };

  const handleRemoveToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const renderActivePage = () => {
    switch (currentPage) {
      case 'history':  return <History  settings={settings} showToast={showToast} />;
      case 'summary':  return <Summary />;
      case 'settings': return <Settings settings={settings} saveSettings={saveSettings} showToast={showToast} />;
      default:         return <Home settings={settings} onNavigate={(page: Page) => setCurrentPage(page)} showToast={showToast} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden relative" style={{ background: 'var(--navy-0)', color: 'var(--text-primary)' }}>

      {/* ── Cosmic background layers ─────────────────────────────────────── */}
      <div className="star-field" />
      <div className="bg-cosmic-orb" />

      {/* ── Splash Screen ────────────────────────────────────────────────── */}
      {showSplash && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center splash-bg"
          style={{ transition: 'opacity 0.5s ease', opacity: splashFade ? 0 : 1, pointerEvents: splashFade ? 'none' : 'auto' }}
        >
          <div className="flex flex-col items-center gap-6 anim-scale-in">
            {/* Gold logo mark */}
            <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(245,158,11,0.35)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 36, color: '#08091a', fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
            </div>
            <div className="text-center">
              <p className="text-label" style={{ color: 'var(--gold)', marginBottom: 8, letterSpacing: '0.2em' }}>Frank Link Logistics</p>
              <h1 className="text-display" style={{ fontSize: 28, color: 'var(--text-primary)' }}>Billing Intelligence</h1>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Space Grotesk' }}>Generative AI Workspace</p>
            </div>
            {/* Animated loading bar */}
            <div style={{ width: 120, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', borderRadius: 999, animation: 'shimmer 1.2s infinite', backgroundSize: '200% 100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DESKTOP SIDEBAR + MAIN CONTENT                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Sidebar (hidden on mobile) ───────────────────────────────────── */}
      <aside
        className="cosmic-sidebar hidden md:flex flex-col relative z-10 shrink-0"
        style={{
          width: sidebarCollapsed ? 72 : 220,
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingTop: 20,
          paddingBottom: 24,
        }}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-4 mb-8" style={{ overflow: 'hidden' }}>
          <div className="logo-mark shrink-0">
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#08091a', fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
          </div>
          {!sidebarCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <p className="text-headline" style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Frank Link</p>
              <p className="text-label" style={{ fontSize: 9, color: 'var(--gold)' }}>Bills ∙ AI System</p>
            </div>
          )}
        </div>

        {/* Gold line */}
        <div className="gold-line mx-4 mb-6" />

        {/* Navigation items */}
        <nav className="flex flex-col gap-1 px-2 flex-grow">
          {NAV_ITEMS.map(({ page, icon, label }) => {
            const isActive = currentPage === page;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`nav-btn ${isActive ? 'nav-btn-active' : ''}`}
                style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', paddingLeft: sidebarCollapsed ? 0 : undefined }}
                title={sidebarCollapsed ? label : undefined}
              >
                <span
                  className={`material-symbols-rounded nav-icon shrink-0`}
                  style={{
                    fontSize: 20,
                    fontVariationSettings: isActive ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 300",
                    color: isActive ? 'var(--gold)' : undefined,
                  }}
                >
                  {icon}
                </span>
                {!sidebarCollapsed && (
                  <span className="sidebar-label">{label}</span>
                )}
                {isActive && !sidebarCollapsed && (
                  <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 8px rgba(245,158,11,0.6)' }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom status + collapse */}
        <div className="px-2 flex flex-col gap-3">
          {/* Connection status */}
          {!sidebarCollapsed && (
            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="status-dot status-dot-green shrink-0" />
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#34d399', textTransform: 'uppercase', fontFamily: 'Space Grotesk' }}>AI Online</p>
                <p style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'Space Grotesk' }}>Gemini 2.5 Flash</p>
              </div>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="nav-btn"
            style={{ justifyContent: 'center', opacity: 0.5 }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden relative z-10">

        {/* ── Top Header Bar ─────────────────────────────────────────────── */}
        <header style={{
          height: 64,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(13,14,36,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          flexShrink: 0,
        }}>
          {/* Left: Page title */}
          <div className="flex items-center gap-3">
            {/* Mobile menu logo */}
            <div className="logo-mark md:hidden">
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#08091a', fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
            </div>
            <div>
              <p className="text-label" style={{ color: 'var(--text-muted)', lineHeight: 1 }}>
                {NAV_ITEMS.find(n => n.page === currentPage)?.label ?? 'Dashboard'}
              </p>
              <p className="text-headline" style={{ fontSize: 15, marginTop: 1 }}>Frank Link Bills</p>
            </div>
          </div>

          {/* Right: status + icon actions */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2" style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid var(--gold-border)', borderRadius: 8 }}>
              <div className="status-dot status-dot-green" />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: 'Space Grotesk' }}>Cloud Sync</span>
            </div>
            <button
              onClick={() => setCurrentPage('settings')}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>settings</span>
            </button>
            {/* Logout button */}
            <button
              id="logout-btn"
              onClick={handleLogout}
              title="Sign out"
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(251,113,133,0.6)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fb7185'; e.currentTarget.style.background = 'rgba(244,63,94,0.12)'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(251,113,133,0.6)'; e.currentTarget.style.background = 'rgba(244,63,94,0.06)'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.15)'; }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0" }}>logout</span>
            </button>
          </div>
        </header>

        {/* ── Page viewport ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto md:pb-0 pb-20" style={{ padding: '28px 28px 40px' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {renderActivePage()}
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MOBILE BOTTOM NAV (md and below)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <nav className="mobile-nav md:hidden fixed bottom-0 left-0 w-full z-20 flex items-center" style={{ height: 72 }}>
        {NAV_ITEMS.map(({ page, icon, label }) => {
          const isActive = currentPage === page;
          return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`mobile-nav-btn ${isActive ? 'mobile-nav-btn-active' : ''}`}
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: 22,
                  fontVariationSettings: isActive ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 300",
                  filter: isActive ? 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' : undefined,
                }}
              >
                {icon}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Toast Notifications ──────────────────────────────────────────── */}
      <Toast messages={toasts} onRemove={handleRemoveToast} />
    </div>
  );
};

export default App;
